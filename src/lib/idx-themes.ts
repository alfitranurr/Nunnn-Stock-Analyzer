/**
 * Peta tema/sektor BEI untuk memperluas "saham terdampak" dari sebuah berita.
 *
 * AI hanya memilih ID tema yang relevan (mis. harga batu bara naik → `coal`), lalu
 * server mengembangkannya menjadi daftar emiten di bawah ini. Dengan begitu daftar
 * saham selalu valid (semua kode diverifikasi ada di IDX_TICKERS) dan tidak bergantung
 * pada AI untuk menghafal 800+ kode emiten.
 *
 * Emiten di tiap tema diurutkan kira-kira dari kapitalisasi/likuiditas terbesar.
 * Kurasi manual: perbarui bila ada emiten baru yang relevan.
 */

export interface IdxTheme {
  id: string;
  id_label: string;
  en_label: string;
  tickers: string[];
}

export const IDX_THEMES: IdxTheme[] = [
  { id: 'bank_big', id_label: 'Bank besar', en_label: 'Large banks', tickers: ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'BRIS', 'BBTN'] },
  { id: 'bank_digital', id_label: 'Bank digital', en_label: 'Digital banks', tickers: ['ARTO', 'BBYB', 'BANK', 'AGRO', 'BBHI'] },
  { id: 'multifinance', id_label: 'Multifinance', en_label: 'Multifinance', tickers: ['BFIN', 'ADMF'] },
  { id: 'coal', id_label: 'Batu bara', en_label: 'Coal', tickers: ['ADRO', 'AADI', 'PTBA', 'ITMG', 'BUMI', 'BYAN', 'INDY', 'HRUM'] },
  { id: 'nickel', id_label: 'Nikel', en_label: 'Nickel', tickers: ['INCO', 'ANTM', 'MBMA', 'NCKL', 'HRUM'] },
  { id: 'gold', id_label: 'Emas & tembaga', en_label: 'Gold & copper', tickers: ['AMMN', 'MDKA', 'ANTM', 'BRMS', 'PSAB', 'ARCI'] },
  { id: 'oil_gas', id_label: 'Minyak & gas', en_label: 'Oil & gas', tickers: ['MEDC', 'ENRG', 'PGAS', 'AKRA', 'ELSA'] },
  { id: 'cpo', id_label: 'Perkebunan sawit (CPO)', en_label: 'Palm oil (CPO)', tickers: ['AALI', 'LSIP', 'SSMS', 'TAPG', 'DSNG', 'SIMP', 'SGRO'] },
  { id: 'petchem', id_label: 'Petrokimia', en_label: 'Petrochemicals', tickers: ['TPIA', 'BRPT'] },
  { id: 'renewable', id_label: 'Energi terbarukan', en_label: 'Renewable energy', tickers: ['BREN', 'PGEO', 'ARKO', 'KEEN'] },
  { id: 'telco', id_label: 'Telekomunikasi & menara', en_label: 'Telecom & towers', tickers: ['TLKM', 'ISAT', 'EXCL', 'MTEL', 'TOWR', 'TBIG'] },
  { id: 'tech', id_label: 'Teknologi & digital', en_label: 'Tech & digital', tickers: ['GOTO', 'EMTK', 'BUKA', 'BELI', 'DCII'] },
  { id: 'media', id_label: 'Media', en_label: 'Media', tickers: ['SCMA', 'MNCN'] },
  { id: 'property', id_label: 'Properti', en_label: 'Property', tickers: ['BSDE', 'CTRA', 'PWON', 'SMRA', 'PANI'] },
  { id: 'construction', id_label: 'Konstruksi & tol', en_label: 'Construction & toll roads', tickers: ['JSMR', 'WIKA', 'PTPP', 'ADHI'] },
  { id: 'cement', id_label: 'Semen', en_label: 'Cement', tickers: ['SMGR', 'INTP'] },
  { id: 'staples', id_label: 'Barang konsumsi', en_label: 'Consumer staples', tickers: ['ICBP', 'INDF', 'UNVR', 'MYOR'] },
  { id: 'poultry', id_label: 'Unggas & pakan', en_label: 'Poultry & feed', tickers: ['CPIN', 'JPFA', 'MAIN'] },
  { id: 'tobacco', id_label: 'Rokok', en_label: 'Tobacco', tickers: ['HMSP', 'GGRM', 'WIIM'] },
  { id: 'retail', id_label: 'Ritel', en_label: 'Retail', tickers: ['AMRT', 'MIDI', 'MAPI', 'ACES', 'ERAA', 'RALS'] },
  { id: 'auto', id_label: 'Otomotif', en_label: 'Automotive', tickers: ['ASII', 'AUTO', 'DRMA', 'SMSM'] },
  { id: 'health', id_label: 'Kesehatan & farmasi', en_label: 'Healthcare & pharma', tickers: ['KLBF', 'SIDO', 'MIKA', 'SILO', 'HEAL'] },
  { id: 'shipping', id_label: 'Pelayaran & logistik', en_label: 'Shipping & logistics', tickers: ['SMDR', 'TMAS'] },
  { id: 'aviation', id_label: 'Penerbangan', en_label: 'Aviation', tickers: ['GIAA'] },
  { id: 'bluechips', id_label: 'Saham berkapitalisasi besar (aliran dana asing/indeks)', en_label: 'Large caps (foreign flows/index)', tickers: ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'TPIA', 'DSSA'] },
];

export const THEME_BY_ID = new Map(IDX_THEMES.map((t) => [t.id, t]));
export const THEME_IDS = IDX_THEMES.map((t) => t.id);

/** Daftar ringkas untuk prompt AI: "id — label (contoh emiten)". */
export function themesForPrompt(): string {
  return IDX_THEMES.map((t) => `${t.id} — ${t.id_label} (${t.tickers.slice(0, 4).join(', ')})`).join('\n');
}
