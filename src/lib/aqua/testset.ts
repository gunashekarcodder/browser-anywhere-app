import a0 from "@/assets/bench/pos-00.jpg.asset.json";
import a1 from "@/assets/bench/pos-02.jpg.asset.json";
import a2 from "@/assets/bench/pos-08.jpg.asset.json";
import a3 from "@/assets/bench/c-101.jpg.asset.json";
import a4 from "@/assets/bench/c-102.jpg.asset.json";
import a5 from "@/assets/bench/c-112.jpg.asset.json";
import a6 from "@/assets/bench/c-113.jpg.asset.json";
import a7 from "@/assets/bench/c-115.jpg.asset.json";
import a8 from "@/assets/bench/c-116.jpg.asset.json";
import a9 from "@/assets/bench/c-117.jpg.asset.json";
import a10 from "@/assets/bench/c-123.jpg.asset.json";
import a11 from "@/assets/bench/c-125.jpg.asset.json";
import a12 from "@/assets/bench/c-126.jpg.asset.json";
import a13 from "@/assets/bench/neg-09.jpg.asset.json";
import a14 from "@/assets/bench/neg-10.jpg.asset.json";
import a15 from "@/assets/bench/neg-11.jpg.asset.json";
import a16 from "@/assets/bench/neg-12.jpg.asset.json";
import a17 from "@/assets/bench/neg-13.jpg.asset.json";
import a18 from "@/assets/bench/neg-14.jpg.asset.json";
import a19 from "@/assets/bench/neg-15.jpg.asset.json";
import a20 from "@/assets/bench/neg-17.jpg.asset.json";
import a21 from "@/assets/bench/c-103.jpg.asset.json";
import a22 from "@/assets/bench/c-104.jpg.asset.json";
import a23 from "@/assets/bench/c-119.jpg.asset.json";
import a24 from "@/assets/bench/c-121.jpg.asset.json";
import a25 from "@/assets/bench/c-127.jpg.asset.json";

/**
 * AquaSentinel held-out benchmark set.
 *
 * 26 real photographs (13 waterlogged road/street scenes, 13 hard negatives:
 * dry roads, rain-wet asphalt, night reflections and puddle glare) collected
 * from openly licensed sources via Openverse. `waterBox` is a coarse,
 * human-drawn normalised water region [x0, y0, x1, y1] used for weak-label
 * IoU — it is a bounding region, not a pixel-perfect segmentation mask, and
 * the IoU figure is reported as such.
 */

export type TestSample = {
  id: string;
  url: string;
  label: "flood" | "clear";
  title: string;
  creator: string;
  licence: string;
  sourcePage: string;
  query: string;
  waterBox: [number, number, number, number] | null;
};

export const TEST_SET: TestSample[] = [
  {
    id: "pos-00",
    url: a0.url,
    label: "flood",
    title: "Flooding at LIRR Stations",
    creator: "MTAPhotos",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/61135621@N03/14906782465",
    query: "flooded street cars water urban",
    waterBox: [0, 0.35, 1, 1],
  },
  {
    id: "pos-02",
    url: a1.url,
    label: "flood",
    title: "Once there was a street",
    creator: "dlerps",
    licence: "by-nd 2.0",
    sourcePage: "https://www.flickr.com/photos/65583387@N04/45702019702",
    query: "flooded street cars water urban",
    waterBox: [0, 0.55, 1, 1],
  },
  {
    id: "pos-08",
    url: a2.url,
    label: "flood",
    title: "Brisbane Floods - Gailes Queensland",
    creator: "martinhoward",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/26752267@N00/5349077346",
    query: "flooded street cars water urban",
    waterBox: [0.3, 0.15, 1, 0.85],
  },
  {
    id: "c-101",
    url: a3.url,
    label: "flood",
    title: "Hoboken 4/16/07: The flood and the fire",
    creator: "David Pfeffer",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/92292780@N00/463188592",
    query: "street flood water knee deep",
    waterBox: [0, 0.55, 1, 1],
  },
  {
    id: "c-102",
    url: a4.url,
    label: "flood",
    title: "Miss, how about a ride ?",
    creator: "nSeika",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/33542052@N07/8388428707",
    query: "street flood water knee deep",
    waterBox: [0, 0.5, 1, 1],
  },
  {
    id: "c-112",
    url: a5.url,
    label: "flood",
    title: "Sudden torrential downpour in Bangalore",
    creator: "ToastyKen",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/24226200@N00/5645787801",
    query: "monsoon flooding street water india",
    waterBox: [0, 0.55, 1, 1],
  },
  {
    id: "c-113",
    url: a6.url,
    label: "flood",
    title: "Monsoon in front of 'Mustafa Dairy'",
    creator: "rabanito",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/8787706@N04/3720124419",
    query: "monsoon flooding street water india",
    waterBox: [0, 0.6, 1, 1],
  },
  {
    id: "c-115",
    url: a7.url,
    label: "flood",
    title: "Women chatting on boat",
    creator: "flowcomm",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/21162417@N07/8138839083",
    query: "monsoon flooding street water india",
    waterBox: [0, 0.55, 1, 1],
  },
  {
    id: "c-116",
    url: a8.url,
    label: "flood",
    title: "Hurricane Sandy Flooding Avenue C 2012",
    creator: "david_shankbone",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/27865228@N06/8139664029",
    query: "hurricane flooding neighborhood street water",
    waterBox: [0, 0.5, 1, 1],
  },
  {
    id: "c-117",
    url: a9.url,
    label: "flood",
    title: "180926-Z-XH297-1005",
    creator: "SC Guard",
    licence: "pdm 1.0",
    sourcePage: "https://www.flickr.com/photos/58720666@N05/44891646772",
    query: "hurricane flooding neighborhood street water",
    waterBox: [0, 0.5, 1, 1],
  },
  {
    id: "c-123",
    url: a10.url,
    label: "flood",
    title: "180926-Z-XH297-1009",
    creator: "SC Guard",
    licence: "pdm 1.0",
    sourcePage: "https://www.flickr.com/photos/58720666@N05/44891639482",
    query: "hurricane flooding neighborhood street water",
    waterBox: [0, 0.35, 1, 1],
  },
  {
    id: "c-125",
    url: a11.url,
    label: "flood",
    title: "180926-Z-XH297-1004",
    creator: "SC Guard",
    licence: "pdm 1.0",
    sourcePage: "https://www.flickr.com/photos/58720666@N05/44891644962",
    query: "hurricane flooding neighborhood street water",
    waterBox: [0, 0.5, 1, 1],
  },
  {
    id: "c-126",
    url: a12.url,
    label: "flood",
    title: "180926-Z-XH297-1006",
    creator: "SC Guard",
    licence: "pdm 1.0",
    sourcePage: "https://www.flickr.com/photos/58720666@N05/44891645622",
    query: "hurricane flooding neighborhood street water",
    waterBox: [0.05, 0.45, 0.75, 1],
  },
  {
    id: "neg-09",
    url: a13.url,
    label: "clear",
    title: "Home from JFK airport, New York",
    creator: "shankar s.",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/77742560@N06/7782126322",
    query: "dry asphalt city road traffic",
    waterBox: null,
  },
  {
    id: "neg-10",
    url: a14.url,
    label: "clear",
    title: "A428 Hardwick Bypass at the Callow Brook footpath bridge",
    creator: "Adrian Cable",
    licence: "by-sa 2.0",
    sourcePage: "https://www.geograph.org.uk/photo/3664531",
    query: "dry asphalt city road traffic",
    waterBox: null,
  },
  {
    id: "neg-11",
    url: a15.url,
    label: "clear",
    title: "Rainford, shopping parade",
    creator: "Mike Faherty",
    licence: "by-sa 2.0",
    sourcePage: "https://www.geograph.org.uk/photo/5489799",
    query: "dry asphalt city road traffic",
    waterBox: null,
  },
  {
    id: "neg-12",
    url: a16.url,
    label: "clear",
    title: "Times Square in the Rain...",
    creator: "Diego3336",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/31018257@N00/284576308",
    query: "wet road night reflection city",
    waterBox: null,
  },
  {
    id: "neg-13",
    url: a17.url,
    label: "clear",
    title: "Night Reflections",
    creator: "player_pleasure",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/22113111@N05/11475164993",
    query: "wet road night reflection city",
    waterBox: null,
  },
  {
    id: "neg-14",
    url: a18.url,
    label: "clear",
    title: "Waiting for the bus somewhere in the rain",
    creator: "Fan.D & Dav.C Photgraphy",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/98815931@N07/50238115517",
    query: "wet road night reflection city",
    waterBox: null,
  },
  {
    id: "neg-15",
    url: a19.url,
    label: "clear",
    title: "Which Way ?",
    creator: "Jonathan Miske",
    licence: "by-sa 2.0",
    sourcePage: "https://www.flickr.com/photos/127035585@N03/25810533526",
    query: "wet road night reflection city",
    waterBox: null,
  },
  {
    id: "neg-17",
    url: a20.url,
    label: "clear",
    title: "Brooklyn Street Scenes - Rainy Night, Food Truck",
    creator: "Steven Pisano",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/45776673@N04/15568622684",
    query: "wet road night reflection city",
    waterBox: null,
  },
  {
    id: "c-103",
    url: a21.url,
    label: "clear",
    title: "Banks Street Flooding",
    creator: "Editor B",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/11018968@N00/4180253346",
    query: "street flood water knee deep",
    waterBox: null,
  },
  {
    id: "c-104",
    url: a22.url,
    label: "clear",
    title: "BanksStreetFlooding12Dec2009NOLA",
    creator: "Flickr photographer Editor B / Bart Everson",
    licence: "by 2.0",
    sourcePage: "https://commons.wikimedia.org/w/index.php?curid=8732058",
    query: "street flood water knee deep",
    waterBox: null,
  },
  {
    id: "c-119",
    url: a23.url,
    label: "clear",
    title: "Adams St Water Main SWB Maple Closing Taps",
    creator: "Infrogmation",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/29350288@N06/8350992530",
    query: "hurricane flooding neighborhood street water",
    waterBox: null,
  },
  {
    id: "c-121",
    url: a24.url,
    label: "clear",
    title: "Another View",
    creator: "Tobyotter",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/78428166@N00/16541983951",
    query: "hurricane flooding neighborhood street water",
    waterBox: null,
  },
  {
    id: "c-127",
    url: a25.url,
    label: "clear",
    title: "Adams St Water Main Hours later Maple Orange cans",
    creator: "Infrogmation",
    licence: "by 2.0",
    sourcePage: "https://www.flickr.com/photos/29350288@N06/8350993498",
    query: "hurricane flooding neighborhood street water",
    waterBox: null,
  },
];

export const TEST_SET_VERSION = "aqua-bench-v1 (26 images, Openverse, 2026-08)";
