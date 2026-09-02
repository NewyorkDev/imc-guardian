import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.IMC_GUARDIAN_URL || 'https://imc-guardian.vercel.app/';
const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await mkdir(new URL('../artifacts/gallery/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-blink-features=WebMCP'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof document.modelContext?.getTools === 'function');
  const result = await page.evaluate(async () => {
    const tools = await document.modelContext.getTools();
    const call = async (name, input = {}) => {
      const tool = tools.find(candidate => candidate.name === name);
      if (!tool) throw new Error(`Missing native tool: ${name}`);
      return JSON.parse(await document.modelContext.executeTool(tool, JSON.stringify(input)));
    };
    const context = await call('set_flight_context', { origin: 'KTPF', destination: 'KTLH', departure: '2026-09-02T18:00:00-04:00', rules: 'VFR', aircraft: 'C172', pilot: 'VFR only' });
    const conditions = await call('check_airport_conditions', { airportIds: ['KTPF', 'KCTY', 'KTLH'] });
    const advisories = await call('check_route_advisories');
    const assessment = await call('assess_route_weather');
    const alternates = await call('find_safer_alternates');
    const options = await call('compare_route_options');
    const explanation = await call('explain_imc_risk');
    const decision = await call('record_pilot_decision', { choice: 'delay' });
    return { toolNames: tools.map(tool => tool.name).sort(), context, conditions, advisories, assessment, alternates, options, explanation, decision };
  });
  await page.screenshot({ path: new URL('../artifacts/gallery/01-home-route.png', import.meta.url).pathname });
  await page.locator('.assessment').scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL('../artifacts/gallery/02-assessment-evidence.png', import.meta.url).pathname });
  await page.locator('.decision').scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL('../artifacts/gallery/03-human-decision.png', import.meta.url).pathname });
  await page.locator('.trace').scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL('../artifacts/gallery/04-webmcp-trace.png', import.meta.url).pathname });
  const artifact = { schemaVersion: 1, generatedAt: new Date().toISOString(), url, browser: 'Google Chrome with WebMCP enabled', ...result };
  await writeFile(new URL('../artifacts/native-webmcp-verification.json', import.meta.url), `${JSON.stringify(artifact, null, 2)}\n`);
  if (pageErrors.length) throw new Error(pageErrors.join(' | '));
  if (result.toolNames.length !== 8 || result.assessment.level !== 'HIGH' || result.assessment.goNoGo !== null || result.alternates.alternates.length !== 3 || result.options.preferred !== null || !result.options.requiresPilotChoice || result.decision.choice !== 'delay') process.exitCode = 1;
  console.log(JSON.stringify({ tools: result.toolNames.length, risk: result.assessment.level, goNoGo: result.assessment.goNoGo, alternates: result.alternates.alternates.length, requiresPilotChoice: result.options.requiresPilotChoice, recordedDecision: result.decision.choice }, null, 2));
} finally {
  await browser.close();
}
