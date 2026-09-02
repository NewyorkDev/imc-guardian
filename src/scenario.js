export const airports = {
  KTPF: { name: 'Peter O. Knight', city: 'Tampa', lat: 27.9167, lon: -82.4493, category: 'VFR', ceiling: 5500, visibility: 10, wind: '220° at 8 kt' },
  KCTY: { name: 'Cross City', city: 'Cross City', lat: 29.6355, lon: -83.1048, category: 'MVFR', ceiling: 2800, visibility: 6, wind: '190° at 11 kt' },
  KTLH: { name: 'Tallahassee International', city: 'Tallahassee', lat: 30.3965, lon: -84.3503, category: 'IFR', ceiling: 900, visibility: 3, wind: '170° at 14 kt' },
  KOCF: { name: 'Ocala International', city: 'Ocala', lat: 29.1726, lon: -82.2242, category: 'VFR', ceiling: 6000, visibility: 10, wind: '210° at 7 kt' },
  KGNV: { name: 'Gainesville Regional', city: 'Gainesville', lat: 29.69, lon: -82.2718, category: 'VFR', ceiling: 4800, visibility: 10, wind: '200° at 9 kt' },
  KVDF: { name: 'Tampa Executive', city: 'Tampa', lat: 28.0139, lon: -82.3453, category: 'VFR', ceiling: 6500, visibility: 10, wind: '230° at 6 kt' }
};

export const demoRoute = {
  origin: 'KTPF', destination: 'KTLH', departure: '2026-09-02T18:00:00-04:00', rules: 'VFR', aircraft: 'C172', pilot: 'VFR only',
  stations: ['KTPF', 'KCTY', 'KTLH'], alternateIds: ['KOCF', 'KGNV', 'KVDF'],
  advisory: { type: 'G-AIRMET IFR', status: 'Forecast', valid: '2100Z–0300Z', detail: 'Ceilings below 1,000 ft and visibility below 3 SM forecast over the northern route corridor.' }
};

export const observations = {
  KTPF: { raw: 'KTPF 022153Z 22008KT 10SM SCT055 31/24 A2992', trend: 'steady', source: 'scenario' },
  KCTY: { raw: 'KCTY 022153Z 19011KT 6SM BKN028 28/24 A2994', trend: 'deteriorating', source: 'scenario' },
  KTLH: { raw: 'KTLH 022153Z 17014KT 3SM BR OVC009 26/24 A2995', trend: 'deteriorating', source: 'scenario' }
};

export const forecasts = {
  KTPF: 'VFR through departure window.',
  KCTY: 'Ceiling lowering from 3,500 ft to 1,800 ft after 2200Z.',
  KTLH: 'Ceiling forecast 1,200 ft, temporarily 700 ft with 2 SM visibility.'
};
