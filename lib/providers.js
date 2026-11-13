/**
 * The accounts the card shows and how the report of each one becomes a view.
 * No network and no credentials here: the host half fetches, this module parses.
 */

/** @typedef {{ kind: "balance", amount: number, currency: string, available: boolean, toppedUp: number | null, granted: number | null }} BalanceView */
/** @typedef {{ key: string, label: string, leftPct: number, resetMs: number }} QuotaWindow */
/** @typedef {{ kind: "usage", windows: QuotaWindow[] }} UsageView */

// the windows of the Kimi report shown in the card, in this order
const KIMI_WINDOWS = [
	["limit_5h", "5h"],
	["limit_month_total", "Month"],
];

/** DeepSeek writes amounts as strings; anything that is not a number is null. */
function amountOf(value) {
	const amount = Number.parseFloat(value);
	return Number.isFinite(amount) ? amount : null;
}

/**
 * The view of `GET https://api.deepseek.com/user/balance`.
 * @returns {BalanceView}
 */
export function parseDeepSeekBalance(report) {
	const info = report?.balance_infos?.find((item) => amountOf(item?.total_balance) !== null);
	if (!info) throw new Error("DeepSeek reported no balance");
	return {
		kind: "balance",
		amount: amountOf(info.total_balance),
		currency: info.currency || "CNY",
		available: report.is_available !== false,
		toppedUp: amountOf(info.topped_up_balance),
		granted: amountOf(info.granted_balance),
	};
}

/**
 * The view of `GET https://api.kimi.com/coding/v1/usages`: what is left of the
 * 5-hour and the monthly window, in percent. A window Kimi omits is skipped.
 * @returns {UsageView}
 */
export function parseKimiUsage(report) {
	const windows = KIMI_WINDOWS.filter(([key]) => typeof report?.usages?.[key]?.used_ratio === "number").map(([key, label]) => ({
		key,
		label,
		leftPct: Math.min(100, Math.max(0, Math.round((1 - report.usages[key].used_ratio) * 100))),
		resetMs: Date.parse(report.usages[key].reset_time),
	}));
	if (windows.length === 0) throw new Error("Kimi reported neither a 5-hour nor a monthly window");
	return { kind: "usage", windows };
}

/** One card row per entry; `credential` is the name the credentials service knows the key by. */
export const PROVIDERS = [
	{
		id: "deepseek",
		label: "DeepSeek",
		credential: "DEEPSEEK_API_KEY",
		url: "https://api.deepseek.com/user/balance",
		parse: parseDeepSeekBalance,
	},
	{
		id: "kimi",
		label: "Kimi",
		credential: "KIMI_CODING_API_KEY",
		url: "https://api.kimi.com/coding/v1/usages",
		parse: parseKimiUsage,
	},
];
