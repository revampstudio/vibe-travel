const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const Module = require('node:module')
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '..', request.slice(2)) : request, ...args) }
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } }).outputText, filename)
}
const test = require('node:test')
const assert = require('node:assert/strict')
const { birthInstant, computeAstroLines, computeChartGeometry, linesFromGeometry, PLANETS } = require('../src/lib/astrocartography.ts')
const { createSharedChart, encodeChart, decodeChart, sharedChartLines, chartShareMessage } = require('../src/lib/chartSharing.ts')
const { compareCharts } = require('../src/lib/compareCharts.ts')
const { getInterpretation } = require('../src/lib/interpretations.ts')
const { parseUtcOffset } = require('../src/lib/birthTime.ts')
const { mapPostcardSvg } = require('../src/lib/mapPostcard.ts')
const birth = { date: '1992-07-14', time: '08:35', utcOffsetMinutes: 600, timeKnown: true, city: 'PRIVATE_BIRTH_CITY', lat: -27.47, lng: 153.02 }
const chart = createSharedChart(birth)
test('local birth time converts across UTC day boundary and fractional offsets', () => {
  assert.equal(birthInstant(birth.date, birth.time, 600).toISOString(), '1992-07-13T22:35:00.000Z')
  assert.deepEqual(computeAstroLines(birth.date, birth.time, 600), computeAstroLines('1992-07-13', '22:35', 0))
  assert.equal(birthInstant('2000-01-01', '00:30', 345).toISOString(), '1999-12-31T18:45:00.000Z')
  assert.equal(parseUtcOffset('+05:45'), 345)
  assert.equal(parseUtcOffset('-04:00'), -240)
  for (const value of ['', '+14:01', '-12:01', '+05:60', '10', '+1:00']) assert.equal(parseUtcOffset(value), null)
})
test('invalid dates and times are rejected, including rollover dates', () => {
  for (const [date,time,offset] of [['2024-02-30','12:00',0],['2023-02-29','12:00',0],['1992-00-14','12:00',0],['1992-07-14','24:00',0],['1992-07-14','12:60',0],['1992-07-14','12:00',Infinity]]) assert.throws(() => birthInstant(date,time,offset))
})
test('real engine produces all planetary angles with bounded, split geometry', () => {
  const lines = sharedChartLines(chart)
  for (const planet of PLANETS) for (const lineType of ['ASC','DSC','MC','IC']) assert.ok(lines.some(line => line.planet === planet && line.lineType === lineType))
  for (const line of lines) for (let i=0;i<line.coordinates.length;i++) {
    const [lng,lat] = line.coordinates[i]; assert.ok(Number.isFinite(lng) && Math.abs(lng)<=180 && Math.abs(lat)<=90)
    if (i) assert.ok(Math.abs(lng-line.coordinates[i-1][0])<=180)
  }
  // Around equinox at noon UTC, the Sun culminates close to Greenwich.
  assert.ok(Math.abs(computeChartGeometry('2024-03-20','12:00',0)[0][0])<3)
})
test('portable export contains only geometry and approximation status and roundtrips', () => {
  const code = encodeChart(chart)
  assert.ok(code.length < 350)
  assert.deepEqual(Object.keys(decodeChart(code)).sort(), ['approximate','geometry','version'])
  assert.ok(!chartShareMessage(chart).includes(birth.city))
  assert.ok(!code.includes(birth.date) && !code.includes(birth.time))
  const decoded = decodeChart(chartShareMessage(chart))
  chart.geometry.flat().forEach((n,i) => assert.ok(Math.abs(n-decoded.geometry.flat()[i])<0.000001))
  assert.equal(decoded.approximate,false)
  assert.equal(createSharedChart({ ...birth, timeKnown: false }).approximate,true)
  assert.equal(createSharedChart({ ...birth, utcOffsetMinutes: undefined }).approximate,true)
})
test('malformed or hostile chart codes fail without silently becoming another chart', () => {
  const code = encodeChart(chart)
  for (const input of ['', 'VTM2:0:1,2', 'VTM1:0:,,,,,,,,,,,,,,,,,,,', code+'x', code+',', code.replace(/-?\d+\.\d+/, '999.000000'), 'x'.repeat(5001), code.replace(/-?\d+\.\d+/, 'NaN')]) assert.throws(() => decodeChart(input))
})
test('comparison requires both charts, is deterministic and changes the travel/live lens', () => {
  const line = (planet,lineType,lng) => ({ planet,lineType,color:'#000000',coordinates:[[lng,-2],[lng,0],[lng,2]] })
  const source = [{ name:'Visit',country:'Australia',lat:0,lng:20 },{ name:'Home',country:'Australia',lat:0,lng:80 },{ name:'Solo',country:'Australia',lat:0,lng:120 }]
  const own = [line('Sun','ASC',20),line('Moon','IC',80),line('Venus','ASC',120)]
  const friend = [line('Mercury','ASC',20),line('Saturn','IC',80)]
  const travel = compareCharts(source,own,friend,'travel')
  assert.equal(travel[0].city.name,'Visit')
  assert.equal(compareCharts(source,own,friend,'live')[0].city.name,'Home')
  assert.equal(travel.length,2)
  assert.deepEqual(travel,compareCharts(source,own,friend,'travel'))
  assert.equal(compareCharts(source,own,[],'travel').length,0)
})
test('every planet and angle has substantive travel/live explanations', () => {
  for (const planet of PLANETS) for (const angle of ['ASC','DSC','MC','IC']) {
    const text = getInterpretation(planet,angle)
    for (const section of ['In astrology','Possibilities:','What to watch:','For a visit:','For a longer stay:']) assert.ok(text.includes(section))
    assert.ok(text.length>600)
  }
})
test('image postcard contains world geography, line legend and no raw birth details', () => {
  const svg = mapPostcardSvg(linesFromGeometry(chart.geometry))
  assert.ok(svg.startsWith('<svg'))
  assert.ok(svg.includes('Natural Earth') && svg.includes('Astrocartography'))
  assert.ok(!svg.includes(birth.date) && !svg.includes(birth.city))
  for (const planet of PLANETS) assert.ok(svg.includes(planet))
})
const { resolveBirthTimeZone } = require('../src/lib/birthTimeZone.ts')
test('birthplace resolves historical IANA offset, including daylight saving and fractional hours', () => {
  assert.equal(resolveBirthTimeZone('1992-07-14','08:35',-27.47,153.02).offsetMinutes,600)
  assert.equal(resolveBirthTimeZone('1992-01-14','08:35',-33.87,151.21).offsetMinutes,660)
  assert.equal(resolveBirthTimeZone('1992-07-14','08:35',-33.87,151.21).offsetMinutes,600)
  assert.equal(resolveBirthTimeZone('1992-07-14','08:35',40.71,-74.01).offsetMinutes,-240)
  assert.equal(resolveBirthTimeZone('1992-01-14','08:35',40.71,-74.01).offsetMinutes,-300)
  assert.equal(resolveBirthTimeZone('1992-07-14','08:35',27.71,85.32).offsetMinutes,345)
})
test('clock-change overlap requires an explicit choice and skipped local times reject', () => {
  const overlap = resolveBirthTimeZone('2020-11-01','01:30',40.71,-74.01)
  assert.equal(overlap.status,'ambiguous')
  assert.deepEqual(overlap.choices.map(c=>c.offsetMinutes),[-240,-300])
  assert.equal(resolveBirthTimeZone('2020-03-08','02:30',40.71,-74.01).status,'invalid')
  assert.equal(resolveBirthTimeZone('2020-03-08','03:30',40.71,-74.01).status,'ready')
  assert.equal(resolveBirthTimeZone('2020-02-30','03:30',40.71,-74.01).status,'invalid')
})
const { migrateLegacyBirthData } = require('../src/lib/migrateBirthData.ts')
test('legacy migration corrects unambiguous records, preserves details/manual offsets, and requires review for uncertainty', () => {
  const legacy = { ...birth }; delete legacy.utcOffsetMinutes
  const migrated = migrateLegacyBirthData(legacy)
  assert.equal(migrated.migrated,true)
  assert.equal(migrated.birthData.utcOffsetMinutes,600)
  for (const key of ['date','time','city','lat','lng']) assert.equal(migrated.birthData[key],legacy[key])
  assert.equal(legacy.utcOffsetMinutes,undefined)
  const manual = { ...birth, utcOffsetMinutes: 570, utcOffsetSource: 'manual' }
  assert.equal(migrateLegacyBirthData(manual).birthData,manual)
  assert.equal(migrateLegacyBirthData({ ...legacy,time:'12:00',timeKnown:undefined }).needsReview,true)
  assert.equal(migrateLegacyBirthData({ ...legacy,timeKnown:false }).needsReview,true)
  assert.equal(migrateLegacyBirthData({ ...legacy,date:'2020-11-01',time:'01:30',lat:40.71,lng:-74.01 }).needsReview,true)
})
