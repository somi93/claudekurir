// vue-leaflet učitava `leaflet/dist/leaflet-src.esm`, a paket `leaflet` u `main`
// polju vodi na UMD build. Ako stranica uveze samo "leaflet", u pregledniku
// postoje DVIJE kopije biblioteke (instanceof L.Map je false i flyToBounds baca
// grešku) - zato mapa uvozi isti ESM fajl kao vue-leaflet. Tipovi su isti kao
// za "leaflet".
declare module "leaflet/dist/leaflet-src.esm" {
  export * from "leaflet";
}
