/**
 * Shared dictionary of popular BEI (IDX) stock tickers -> cleaned company names.
 * Used for instant local lookup (no network round-trip) across ticker search,
 * calculator forms, and any module that needs to resolve a symbol to a name.
 *
 * Server-safe (no 'use client') — can be imported from API routes and components.
 */
export const IDX_TICKERS: Record<string, string> = {
  // Perbankan
  BELL: "Trisula Textile Industries Tbk",
  BBCA: "Bank Central Asia Tbk",
  BBRI: "Bank Rakyat Indonesia Tbk",
  BMRI: "Bank Mandiri Tbk",
  BBNI: "Bank Negara Indonesia Tbk",
  BBTN: "Bank Tabungan Negara Tbk",
  BDMN: "Bank Danamon Indonesia Tbk",
  BRIS: "Bank Syariah Indonesia Tbk",
  ARTO: "Bank Jago Tbk",
  BBYB: "Bank Neo Commerce Tbk",
  MEGA: "Bank Mega Tbk",
  PNBN: "Bank Pan Indonesia Tbk",
  BSIM: "Bank Sinarmas Tbk",
  BJBR: "Bank Pembangunan Daerah Jawa Barat dan Banten Tbk",
  BJTM: "Bank Pembangunan Daerah Jawa Timur Tbk",

  // Pertambangan & Energi
  ANTM: "Aneka Tambang Tbk",
  CUAN: "Petrindo Jaya Kreasi Tbk",
  ADRO: "Adaro Energy Indonesia Tbk",
  ADMR: "Adaro Minerals Indonesia Tbk",
  PTBA: "Bukit Asam Tbk",
  HRUM: "Harum Energy Tbk",
  ITMG: "Indo Tambangraya Megah Tbk",
  INDY: "Indika Energy Tbk",
  MEDC: "Medco Energi Internasional Tbk",
  PGAS: "Perusahaan Gas Negara Tbk",
  BUMI: "Bumi Resources Tbk",
  BRMS: "Bumi Resources Minerals Tbk",
  DOID: "Delta Dunia Makmur Tbk",
  AKRA: "AKR Corporindo Tbk",
  MBMA: "Merdeka Battery Materials Tbk",
  NCKL: "Trimegah Bangun Persada Tbk",
  MDKA: "Merdeka Copper Gold Tbk",
  TPIA: "Chandra Asri Pacific Tbk",
  BRPT: "Barito Pacific Tbk",
  BREN: "Barito Renewables Energy Tbk",
  AMMN: "Amman Mineral Internasional Tbk",
  PGEO: "Pertamina Geothermal Energy Tbk",
  NICL: "Mineral Sumberdaya Mandiri Tbk",
  MBSS: "Mitrabahtera Suksesjaya Tbk",
  NSSI: "Nusantara Sejahtera Raya Tbk",

  // Infrastruktur, Telko & Utilitas
  TLKM: "Telkom Indonesia Tbk",
  ISAT: "Indosat Ooredoo Hutchison Tbk",
  EXCL: "XL Axiata Tbk",
  FREN: "Smartfren Telecom Tbk",
  TOWR: "Sarana Menara Nusantara Tbk",
  TBIG: "Tower Bersama Infrastructure Tbk",
  JSMR: "Jasa Marga Tbk",
  WIKA: "Wijaya Karya Tbk",
  PTPP: "PP (Persero) Tbk",
  ADHI: "Adhi Karya Tbk",

  // Consumer Goods & Health
  UNVR: "Unilever Indonesia Tbk",
  ICBP: "Indofood CBP Sukses Makmur Tbk",
  INDF: "Indofood Sukses Makmur Tbk",
  MYOR: "Mayora Indah Tbk",
  KLBF: "Kalbe Farma Tbk",
  SIDO: "Industri Jamu Dan Farmasi Sido Muncul Tbk",
  GGRM: "Gudang Garam Tbk",
  HMSP: "H.M. Sampoerna Tbk",
  CPIN: "Charoen Pokphand Indonesia Tbk",
  JPFA: "Japfa Comfeed Indonesia Tbk",
  MIKA: "Mitra Keluarga Karyasehat Tbk",
  HEAL: "Medikaloka Hermina Tbk",
  SILO: "Siloam International Hospitals Tbk",

  // Retail & Perdagangan
  MAPI: "Mitra Adiperkasa Tbk",
  MAPA: "MAP Active Adiperkasa Tbk",
  ACES: "Aspirasi Hidup Indonesia Tbk",
  LPPF: "Matahari Department Store Tbk",
  ERAA: "Erajaya Swasembada Tbk",
  AMRT: "Sumber Alfaria Trijaya Tbk",

  // Otomotif & Konglomerasi
  ASII: "Astra International Tbk",
  AUTO: "Astra Otoparts Tbk",
  ASSA: "Adi Sarana Armada Tbk",
  MPMX: "Mitra Pinasthika Mustika Tbk",

  // Properti & Real Estate
  BSDE: "Bumi Serpong Damai Tbk",
  PWON: "Pakuwon Jati Tbk",
  SMRA: "Summarecon Agung Tbk",
  CTRA: "Ciputra Development Tbk",
  ASRI: "Alam Sutera Realty Tbk",
  DMAS: "Puradelta Lestari Tbk",

  // Teknologi & Media
  GOTO: "GoTo Gojek Tokopedia Tbk",
  BUKA: "Bukalapak.com Tbk",
  BELI: "Global Digital Niaga Tbk (Blibli)",
  EMTK: "Elang Mahkota Teknologi Tbk",
  SCMA: "Surya Citra Media Tbk",
  JELI: "PT Niramas Utama Tbk (INACO)",
  FILM: "MD Pictures Tbk",
  MARK: "Mark Dynamics Indonesia Tbk",

  // Transportasi & Logistik
  BIRD: "Blue Bird Tbk",
  SMDR: "Samudera Indonesia Tbk",
  TMAS: "Temas Tbk",

  // Lainnya
  DRMA: "Dharma Polimetal Tbk",
  SRTG: "Saratoga Investama Sedaya Tbk",
  TAPG: "Triputra Agro Persada Tbk",
  UNTR: "United Tractors Tbk",
  INKP: "Indah Kiat Pulp & Paper Tbk",
  BSSR: "Baramulti Suksessarana Tbk",
  CLEO: "Sariguna Primatirta Tbk",
  BTPS: "Bank BTPN Syariah Tbk",
  BINO: "Perma Plasindo Tbk",
  PANS: "Panin Sekuritas Tbk",
  TOTL: "Total Bangun Persada Tbk",
  SMGR: "Semen Indonesia (Persero) Tbk",
  INTP: "Indocement Tunggal Prakarsa Tbk",
  MEDS: "Minna Padi Investama Sekuritas Tbk",
  MNCN: "Media Nusantara Citra Tbk",
  // Volatile / frequent top movers
  NATO: "Indofood SUKSES Makmur Tbk",
  SAPX: "Satria Antaran Prima Tbk",
  PTSP: "Pelayaran Tempuran Emas Tbk",
  BTEK: "Borneo Teknokrat Indonesia Tbk",
};

/**
 * Resolve a ticker symbol to a cleaned company name.
 * Returns the symbol itself (uppercased) when not found in the dictionary.
 */
export function resolveTickerName(symbol: string | null | undefined): string {
  if (!symbol) return "";
  const clean = symbol.toUpperCase().trim().replace(/\.JK$/i, "");
  return IDX_TICKERS[clean] ?? clean;
}
