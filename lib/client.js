/**
 * Browser half: a badge in the composer toolbar with what is left of the Kimi
 * 5-hour window. Hovering it opens a compact card, a row per account; a click
 * on a row unfolds its details. The rows come from the host half and are
 * fetched again every 10 seconds.
 */
window.__ModuleLoader__.load({
	id: "dsh-quota",
	factory: (require) => {
		const { createElement: h, useEffect, useState } = require("react");

		const API = "/dsh-quota/api/rows";
		const REFRESH_MS = 10_000;
		// the window the badge shows
		const BADGE_WINDOW = "limit_5h";
		// percent of a window left below which it turns from green to amber and to red
		const LEFT_WARN_PCT = 60;
		const LEFT_ERROR_PCT = 30;
		// the ring is drawn like the context meter beside it
		const RING_RADIUS = 5.5;
		const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
		const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

		const STYLE = `
			.dsh-quota-badge { position: relative; display: inline-flex; }
			.dsh-quota-badge [data-state="ok"] { --quota-state: var(--dsw-static-green-500, #22c55e); }
			.dsh-quota-badge [data-state="warn"] { --quota-state: var(--dsw-static-amber-500, #f59e0b); }
			.dsh-quota-badge [data-state="error"] { --quota-state: var(--dsw-static-red-500, #ef4444); }
			.dsh-quota-badge [data-state="idle"] { --quota-state: rgba(128, 128, 128, 0.7); }

			.dsh-quota-badge > button {
				display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px;
				border: none; border-radius: var(--dsw-radius-sm, 8px); background: transparent;
				color: inherit; opacity: 0.8; cursor: default;
				font-size: 12px; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap;
				transition: background-color 0.15s ease, opacity 0.15s ease;
			}
			.dsh-quota-badge:hover > button {
				background: rgba(128, 128, 128, 0.18); opacity: 1;
			}

			.dsh-quota-ring { flex-shrink: 0; display: block; }
			.dsh-quota-ring circle { fill: none; stroke: rgba(128, 128, 128, 0.3); stroke-width: 2; }
			.dsh-quota-ring circle + circle {
				stroke: var(--quota-state); stroke-linecap: round;
				transition: stroke-dasharray 0.6s ${EASE}, stroke 0.2s ease;
			}

			/* the padding bridges the gap to the badge, so the pointer can travel into the card */
			.dsh-quota-popover {
				position: absolute; bottom: 100%; right: 0; z-index: 1000; padding-bottom: 8px; cursor: default;
				opacity: 0; visibility: hidden; transform: translateY(8px) scale(0.96); transform-origin: bottom right;
				transition: opacity 0.16s ease, transform 0.26s ${EASE}, visibility 0s 0.26s;
			}
			.dsh-quota-badge:hover .dsh-quota-popover {
				opacity: 1; visibility: visible; transform: none; transition-delay: 0s;
			}
			.dsh-quota-card {
				width: 272px; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px;
				border: 0.5px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.3));
				border-radius: var(--dsw-radius-lg, 16px);
				background: var(--dsw-menu-surface-fill, rgba(67, 69, 74, 0.45));
				backdrop-filter: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
				box-shadow: var(--dsw-elevation-prominent, 0 8px 28px rgba(0, 0, 0, 0.35));
				color: var(--dsw-alias-label-primary, inherit);
				font-size: 13px; line-height: 18px; font-variant-numeric: tabular-nums; text-align: left;
			}

			/* the accounts rise into place one after another when the card opens */
			.dsh-quota-account { opacity: 0; transform: translateY(6px); transition: opacity 0.22s ease, transform 0.3s ${EASE}; }
			.dsh-quota-badge:hover .dsh-quota-account {
				opacity: 1; transform: none; transition-delay: 0.04s;
			}
			.dsh-quota-badge:hover .dsh-quota-account + .dsh-quota-account { transition-delay: 0.1s; }

			.dsh-quota-row {
				display: flex; align-items: center; gap: 10px; padding: 8px 10px;
				border-radius: 10px; white-space: nowrap; cursor: pointer; outline: none;
				transition: background-color 0.15s ease;
			}
			.dsh-quota-row:hover, .dsh-quota-row:focus-visible, .dsh-quota-row[aria-expanded="true"] { background: rgba(128, 128, 128, 0.14); }
			.dsh-quota-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
			.dsh-quota-value { flex: none; display: flex; gap: 12px; font-weight: 600; }
			.dsh-quota-value span { color: var(--quota-state); transition: color 0.2s ease; }
			.dsh-quota-value small {
				margin-right: 5px; font-size: 11px; font-weight: 500;
				color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.95));
			}

			/* the details unfold: a grid row grows from zero to the height of its content */
			.dsh-quota-fold { display: grid; cursor: pointer; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows 0.3s ${EASE}, opacity 0.22s ease; }
			.dsh-quota-fold[data-open] { grid-template-rows: 1fr; opacity: 1; }
			.dsh-quota-fold > div { min-height: 0; overflow: hidden; }
			.dsh-quota-detail {
				display: flex; flex-direction: column; gap: 10px; padding: 2px 10px 10px;
				font-size: 12px; line-height: 16px; white-space: normal;
				color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 0.95));
			}
			.dsh-quota-line { display: flex; justify-content: space-between; gap: 10px; }
			.dsh-quota-line b { font-weight: 500; color: var(--dsw-alias-label-primary, inherit); }
			.dsh-quota-bar { height: 4px; margin-top: 5px; border-radius: 999px; background: rgba(128, 128, 128, 0.22); }
			/* the bar fills from the left each time the details open */
			.dsh-quota-bar div {
				height: 100%; border-radius: inherit; background: var(--quota-state);
				transform: scaleX(0); transform-origin: left;
				transition: transform 0.7s ${EASE} 0.1s, width 0.4s ease, background-color 0.2s ease;
			}
			.dsh-quota-fold[data-open] .dsh-quota-bar div { transform: none; }
			.dsh-quota-note { padding: 8px 10px; font-size: 12px; color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 0.95)); }
			.dsh-quota-error { padding: 8px 10px; font-size: 12px; color: var(--dsw-static-red-500, #ef4444); white-space: normal; word-break: break-word; }
			.dsh-quota-detail .dsh-quota-error, .dsh-quota-detail .dsh-quota-note { padding: 0; }

			@media (prefers-reduced-motion: reduce) {
				.dsh-quota-badge, .dsh-quota-badge * { transition-duration: 0s !important; transition-delay: 0s !important; }
			}
			/* the compact mode of remote-web-ui collapses the toolbar row to zero width; the badge
			   is pinned to its right edge instead, left of the send button and the context meter */
			body.dsh-remote-compact-picker .dsh-quota-badge {
				position: absolute !important; right: 112px; top: 50%; transform: translateY(-50%); z-index: 3;
			}
		`;

		/** The rows of the card as { rows }, or { error } when the host could not be asked. */
		async function fetchQuota() {
			try {
				let response = await fetch(API);
				// the host answers loopback only; a phone asks through the remote-web-ui channel, which re-issues the request there
				const device = response.status === 403 ? sessionStorage.getItem("dsh-remote-device") : null;
				if (device) response = await fetch(`/remote${API}`, { headers: { "x-dsh-remote-device": device } });
				return await response.json();
			} catch (err) {
				return { error: err.message };
			}
		}

		/** The quota, fetched again every REFRESH_MS while the page is visible; null until the first answer. `now` ticks every second. */
		function useQuota() {
			const [quota, setQuota] = useState(null);
			const [now, setNow] = useState(Date.now());
			useEffect(() => {
				let mounted = true;
				const refresh = () => document.hidden || fetchQuota().then((fetched) => mounted && setQuota(fetched));
				refresh();
				document.addEventListener("visibilitychange", refresh);
				const refreshTimer = setInterval(refresh, REFRESH_MS);
				const clockTimer = setInterval(() => setNow(Date.now()), 1000);
				return () => {
					mounted = false;
					document.removeEventListener("visibilitychange", refresh);
					clearInterval(refreshTimer);
					clearInterval(clockTimer);
				};
			}, []);
			return { quota, now };
		}

		function money(amount, currency) {
			if (amount === null) return "—";
			const symbol = { CNY: "¥", USD: "$" }[currency];
			return symbol ? `${symbol}${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`;
		}

		/** Time left as 1d 3h, 2h 15m, 5m or 30s. */
		function countdown(leftMs) {
			const seconds = Math.max(0, Math.floor(leftMs / 1000));
			const days = Math.floor(seconds / 86400);
			const hours = Math.floor((seconds % 86400) / 3600);
			const minutes = Math.floor((seconds % 3600) / 60);
			if (days > 0) return `${days}d ${hours}h`;
			if (hours > 0) return `${hours}h ${minutes}m`;
			if (minutes > 0) return `${minutes}m`;
			return `${seconds}s`;
		}

		function windowState(leftPct) {
			if (leftPct < LEFT_ERROR_PCT) return "error";
			return leftPct < LEFT_WARN_PCT ? "warn" : "ok";
		}

		/** The colour of an account: green for a balance that can be spent, else that of the window with the least left. */
		function accountState(row) {
			if (row.error) return "error";
			if (row.view.kind === "balance") return row.view.available ? "ok" : "idle";
			return windowState(Math.min(...row.view.windows.map((window) => window.leftPct)));
		}

		function Ring({ pct }) {
			const arc = (RING_LENGTH * pct) / 100;
			return h(
				"svg",
				{ className: "dsh-quota-ring", viewBox: "0 0 14 14", width: 14, height: 14, "aria-hidden": true },
				h("circle", { cx: 7, cy: 7, r: RING_RADIUS }),
				// a round cap would draw an arc of zero length as a dot
				pct > 0 &&
					h("circle", { cx: 7, cy: 7, r: RING_RADIUS, strokeDasharray: `${arc} ${RING_LENGTH}`, transform: "rotate(-90 7 7)" }),
			);
		}

		/** The right side of a row. An exhausted window says when it resets instead of 0%. */
		function RowValue({ row, now }) {
			if (row.error) return h("span", { "data-state": "error" }, "—");
			if (row.view.kind === "balance") return h("span", null, money(row.view.amount, row.view.currency));
			return row.view.windows.map((window) =>
				h(
					"span",
					{ key: window.key, "data-state": windowState(window.leftPct) },
					h("small", null, window.label),
					window.leftPct === 0 && window.resetMs > now ? countdown(window.resetMs - now) : `${window.leftPct}%`,
				),
			);
		}

		function WindowDetail({ window, now }) {
			return h(
				"div",
				{ "data-state": windowState(window.leftPct) },
				h(
					"div",
					{ className: "dsh-quota-line" },
					h("span", null, h("b", null, window.label), ` ${window.leftPct}% left`),
					window.resetMs > now && `resets in ${countdown(window.resetMs - now)}`,
				),
				h("div", { className: "dsh-quota-bar" }, h("div", { style: { width: `${window.leftPct}%` } })),
			);
		}

		function BalanceDetail({ view }) {
			if (!view.available) return "The balance is not available for API calls.";
			return h(
				"div",
				{ className: "dsh-quota-line" },
				h("span", null, "Topped-up ", h("b", null, money(view.toppedUp, view.currency))),
				h("span", null, "Granted ", h("b", null, money(view.granted, view.currency))),
			);
		}

		function Detail({ row, now }) {
			const { view } = row;
			return h(
				"div",
				{ className: "dsh-quota-detail" },
				row.error && h("div", { className: "dsh-quota-error" }, row.error),
				row.stale && h("div", { className: "dsh-quota-note" }, `${row.label} does not answer; these are its last numbers.`),
				view?.kind === "balance" && h(BalanceDetail, { view }),
				view?.kind === "usage" && view.windows.map((window) => h(WindowDetail, { key: window.key, window, now })),
			);
		}

		function Account({ row, now, open, onToggle }) {
			const onKeyDown = (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				onToggle();
			};
			return h(
				"div",
				{ className: "dsh-quota-account", "data-state": accountState(row) },
				h(
					"div",
					{ className: "dsh-quota-row", role: "button", tabIndex: 0, "aria-expanded": open, onClick: onToggle, onKeyDown },
					h("span", { className: "dsh-quota-name" }, row.label),
					h("span", { className: "dsh-quota-value" }, h(RowValue, { row, now })),
				),
				h("div", { className: "dsh-quota-fold", "data-open": open ? "" : undefined, onClick: onToggle }, h("div", null, h(Detail, { row, now }))),
			);
		}

		function Card({ quota, now, openId, setOpenId }) {
			if (quota === null) return h("div", { className: "dsh-quota-note" }, "Loading…");
			if (quota.error) return h("div", { className: "dsh-quota-error" }, `Request failed: ${quota.error}`);
			return quota.rows.map((row) =>
				h(Account, { key: row.id, row, now, open: openId === row.id, onToggle: () => setOpenId(openId === row.id ? null : row.id) }),
			);
		}

		function Badge() {
			const { quota, now } = useQuota();
			// the account whose details are unfolded; the card opens folded every time
			const [openId, setOpenId] = useState(null);
			const windows = quota?.rows?.flatMap((row) => row.view?.windows ?? []);
			const leftPct = windows?.find((window) => window.key === BADGE_WINDOW)?.leftPct;
			return h(
				"div",
				{ className: "dsh-quota-badge", onMouseLeave: () => setOpenId(null) },
				h(
					"button",
					{ type: "button", "data-state": leftPct === undefined ? "idle" : windowState(leftPct) },
					h(Ring, { pct: leftPct ?? 0 }),
					leftPct === undefined ? "--" : `${leftPct}%`,
				),
				h("div", { className: "dsh-quota-popover" }, h("div", { className: "dsh-quota-card" }, h(Card, { quota, now, openId, setOpenId }))),
			);
		}

		function apply(ctx) {
			const style = document.createElement("style");
			style.textContent = STYLE;
			document.head.append(style);
			ctx.effect(() => () => style.remove());

			const slot = { name: "conversation.input.right", id: "dsh-quota", order: 100, label: () => "Quota" };
			ctx.slots.inject(slot.name, () => ctx.slots.register(slot, () => h(Badge)));
		}

		return { apply, inject: ["slots"] };
	},
});
