/**
 * One-off: report the container's public egress IP and geo.
 * Run: railway run tsx scripts/diagnose-egress.ts
 */
async function main() {
  const ip = (await fetch('https://ifconfig.me/ip').then((r) => r.text())).trim();
  let geo: Record<string, unknown> = {};
  try {
    geo = (await fetch(`https://ipapi.co/${ip}/json/`).then((r) => r.json())) as Record<
      string,
      unknown
    >;
  } catch {
    geo = { error: 'geo lookup failed' };
  }
  console.log(
    JSON.stringify(
      {
        egressIp: ip,
        country: geo.country_name ?? geo.country,
        region: geo.region,
        city: geo.city,
        org: geo.org,
      },
      null,
      2
    )
  );
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
