import type { Night } from '../digest/types.js';

const missing = '—';

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? missing}</td>
                <td>{row.runs}</td>
                <td class={row.retries >= 3 ? 'warn' : undefined}>
                  {row.retries >= 3 ? `${row.retries} · retrying` : row.retries}
                </td>
                <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>
                  {row.lastStatus === 'fail' ? 'fail · failed' : row.lastStatus}
                </td>
                <td>{row.lastError ?? missing}</td>
                <td>{row.first}</td>
                <td>{row.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p class="mute">
        {night.counts.ok} ok · {night.counts.retry} retry · {night.counts.fail} fail
        {night.badLines > 0 ? ` · ${night.badLines} ${night.badLines === 1 ? 'line' : 'lines'} did not parse` : ''}
      </p>
    </>
  );
}
