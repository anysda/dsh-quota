# dsh-quota

A DeepSeek Harness web client plugin that shows the Kimi Code quota and the
DeepSeek balance.

The badge in the composer toolbar shows what is left of the Kimi 5-hour
window. Hovering it opens a compact card with a row per account: the 5-hour
and the monthly window of Kimi and the balance of the DeepSeek API account.
A click on a row unfolds its details: a bar for each window with the time
until it resets, or how much of the balance was topped up and how much was
granted. A window is green from 60% left, amber from 30% and red below. The
numbers refresh every 10 seconds while the page is visible.

## Installation

In DeepSeek Harness open **Plugins**, click **Add plugin** and paste the
repository address:

```text
https://github.com/anysda/dsh-quota
```

The plugin uses the keys DeepSeek Harness already has, `DEEPSEEK_API_KEY` and
`KIMI_CODING_API_KEY`: the ones in its credentials, in the environment or in
`~/.dsh/.credentials.yaml`. The keys stay in the host process, and the page
asks the host for the numbers.

## License

The code is under the [MIT License](LICENSE).
