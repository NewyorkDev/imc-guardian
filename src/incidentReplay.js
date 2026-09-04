export const delta175Replay = {
  caseId: "delta-175-2023",
  title: "Delta 175 evidence replay",
  flight: "DAL175",
  route: "MXP to ATL",
  aircraft: "Airbus A350-941, N576DZ",
  date: "August 29, 2023",
  eventTimeUtc: "2023-08-29T22:31:15Z",
  eventPosition: {
    fix: "Near OZZZI on arrival to Atlanta",
    latitude: 34.095633,
    longitude: -83.834486,
    pressureAltitudeFt: 15100,
    computedAirspeedKt: 312,
  },
  sourceMode: "Historical evidence replay from the NTSB final report and public docket",
  source: {
    agency: "National Transportation Safety Board",
    report: "DCA23FA428 Final Report",
    reportUrl:
      "https://data.ntsb.gov/carol-repgen/api/Aviation/ReportMain/GenerateNewestReport/192959/pdf",
    docketUrl: "https://data.ntsb.gov/Docket?ProjectID=192959",
    published: "June 19, 2025",
  },
  timeline: [
    {
      time: "22:22 UTC",
      label: "Weather discussed",
      detail: "The crew discussed cloud fronts and the possible need for a deviation during descent.",
    },
    {
      time: "22:26 UTC",
      label: "Deviation requested",
      detail: "The crew requested a deviation west near KILRR and accepted an instruction to continue toward OZZZI.",
    },
    {
      time: "22:28 UTC",
      label: "Cabin warned",
      detail: "The relief pilot advised the cabin that turbulence might be encountered in about five minutes.",
    },
    {
      time: "22:30 UTC",
      label: "Concern stated",
      detail: "The crew reported that the ride was good, but conditions were about to get worse because a cloud was ahead.",
    },
    {
      time: "22:31:15 UTC",
      label: "Severe turbulence",
      detail: "The aircraft encountered severe turbulence near OZZZI at about 15,100 feet pressure altitude.",
    },
  ],
  crewPicture: [
    "General convective weather was present in the area.",
    "The crew was monitoring weather and intended to deviate around other cells.",
    "The seat belt sign was illuminated and the cabin received an early warning.",
    "There were no preceding PIREPs, nearby radar returns, or significant Flight Weather Viewer turbulence indications for the encounter location.",
  ],
  weatherEvidence: [
    {
      label: "ATL SURFACE",
      value: "VMC · 10 SM visibility",
      detail: "Few clouds at 3,800 feet AGL and broken clouds at 11,000 feet AGL",
    },
    {
      label: "CONVECTIVE SETUP",
      value: "Warm, moist air mass",
      detail: "A stationary front and Hurricane Idalia supported cumulus and cumulonimbus development",
    },
    {
      label: "RADAR EVOLUTION",
      value: "Rapid development",
      detail: "NWS radar echoes were not identifiable until minutes before the encounter",
    },
    {
      label: "PRIOR REPORTS",
      value: "No urgent or severe PIREP",
      detail: "Available reports did not provide a severe warning before DAL175 crossed the location",
    },
  ],
  observedEvent: {
    duration: "About 3 seconds",
    verticalAcceleration: "+1.69g to -0.97g in less than one second",
    verticalSpeed: "+3,000 to -10,600 feet per minute",
    injuries: "4 serious, 13 minor",
    aircraftDamage: "Minor",
  },
  investigationFindings: [
    "The flight crew's performance before the encounter was consistent with standard practices.",
    "Rapidly developing, low-precipitation cumulus made the turbulence risk unapparent on aircraft weather radar and ATC scopes.",
    "Regional radar imagery showed echoes developing rapidly and not becoming identifiable until minutes before the encounter.",
    "The NTSB found that near-real-time Graphic Turbulence Guidance Nowcast capability could have alerted the crew earlier to secure the cabin.",
  ],
};

export const delta175Verdict = {
  label: "CONCERN SUPPORTED · ACTION NOT JUDGED",
  concernSupported: true,
  actionJudgment: null,
  finding:
    "The crew's concern that conditions were about to worsen was borne out about a minute later by the severe turbulence encounter.",
  evidenceGap:
    "The rapidly developing, low-precipitation cell was not apparent on aircraft weather radar or ATC scopes.",
  additionalChannel:
    "The NTSB found that near-real-time GTGN capability could have provided earlier awareness to help secure the cabin.",
  notSupported:
    "The investigation does not establish that a different route choice or this prototype would have prevented the encounter.",
};
