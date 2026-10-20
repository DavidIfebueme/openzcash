import rawPitches from './pitches.json';
import spanish from './es.json';

export const locales = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof locales)[number];
export type Localized = Record<Locale, string>;
export const lengths = ['sentence', '30s', '60s'] as const;
export type PitchLength = (typeof lengths)[number];
export const reviewedAt = '2026-10-20';
export const localized = (en: string, pt: string): Localized => ({ en, 'pt-BR': pt, es: (spanish as Record<string, string>)[en] ?? en });
export const audiences = {
  beginners: localized('Beginners', 'Iniciantes'),
  bitcoin: localized('Bitcoin users', 'Quem conhece Bitcoin'),
  developers: localized('Developers', 'Desenvolvedores'),
  businesses: localized('Businesses', 'Negócios'),
  organizations: localized('Organizations', 'Organizações'),
};
export type Audience = keyof typeof audiences;
export const lengthLabels: Record<PitchLength, Localized> = {
  sentence: localized('One sentence', 'Uma frase'),
  '30s': localized('≈ 30 seconds', '≈ 30 segundos'),
  '60s': localized('≈ 60 seconds', '≈ 60 segundos'),
};
export const sheetUrl = 'https://docs.google.com/spreadsheets/d/1BOl7YEARrMQISaCmNa-C9yW3hDBn5x6y/edit';
export const cellUrl = (cell: string) => `${sheetUrl}#gid=494982174&range=${cell}`;
export const sources = [
  { id: 'sheet', kind: 'community', title: 'Community elevator pitches · Elevator Pitch', url: `${sheetUrl}#gid=494982174`, note: localized('124 contributions read from the XLSX export. Individual cells are linked below each pitch; names are retained only when explicit.', '124 contribuições lidas pela exportação XLSX. Cada pitch aponta para suas células; nomes são preservados somente quando explícitos.') },
  { id: 'document', kind: 'community', title: 'Elevator Pitches: “What Is Zcash?”', url: 'https://docs.google.com/document/d/1LLYzEBzGQUGJK6VeuY0hGc15CbgG1EFi1as9l6tMa_w/edit', note: localized('Read via text export. Its eight families organize this library; repeated wording is not an extra vote.', 'Lido pela exportação de texto. Suas oito famílias organizam a biblioteca; repetições não são votos adicionais.') },
  { id: 'learn', kind: 'technical', title: 'Learn Zcash', url: 'https://z.cash/learn/', note: localized('Introductory learning directory and next steps.', 'Diretório introdutório de aprendizado e próximos passos.') },
  { id: 'use', kind: 'technical', title: 'How to use Zcash', url: 'https://z.cash/learn/how-to-use-zcash/', note: localized('Wallet support and the choice of shielded or transparent payments.', 'Suporte de carteiras e escolha entre pagamentos shielded e transparentes.') },
  { id: 'shielded', kind: 'technical', title: 'Shielded and transparent Zcash', url: 'https://z.cash/learn/what-is-the-difference-between-shielded-and-transparent-zcash/', note: localized('Which payment details remain public and which are shielded.', 'Quais detalhes dos pagamentos ficam públicos e quais são protegidos.') },
  { id: 'proofs', kind: 'technical', title: 'What are zero-knowledge proofs?', url: 'https://z.cash/learn/what-are-zero-knowledge-proofs/', note: localized('The role of cryptographic proofs in private verification.', 'O papel das provas criptográficas na verificação privada.') },
  { id: 'supply', kind: 'technical', title: 'Does Zcash have a max supply?', url: 'https://z.cash/learn/does-zcash-have-a-max-supply/', note: localized('Used for the 21 million cap, not its price or investment language.', 'Usada para o limite de 21 milhões, não para sua linguagem de preço ou investimento.') },
  { id: 'protocol', kind: 'technical', title: 'Zcash Protocol Specification', url: 'https://zips.z.cash/protocol/protocol.pdf', note: localized('Version v2026.7.0-318-ga34cfc, dated October 16, 2026. Sections 3.1–3.2, 3.10, 4.2 and 4.20: keys, shielded pools, issuance and disclosure. This URL may later serve a newer version.', 'Versão v2026.7.0-318-ga34cfc, de 16/10/2026. Seções 3.1–3.2, 3.10, 4.2 e 4.20: chaves, pools shielded, emissão e divulgação. A URL pode servir uma versão mais recente no futuro.') },
  { id: 'keys', kind: 'technical', title: 'ZIP 310 · Security Properties of Sapling Viewing Keys', url: 'https://zips.z.cash/zip-0310', note: localized('Informational draft describing existing Sapling key properties, not a newly activated feature or a guarantee about every wallet.', 'Rascunho informativo sobre propriedades de chaves Sapling existentes, não um recurso recém-ativado nem garantia sobre toda carteira.') },
  { id: 'privacy', kind: 'technical', title: 'Privacy Recommendations and Best Practices', url: 'https://zcash.readthedocs.io/en/master/rtd_pages/privacy_recommendations_best_practices.html', note: localized('Used for metadata, viewing-key and network limitations. Legacy zcashd setup advice is not a wallet recommendation here.', 'Usada para limites de metadados, chaves de visualização e rede. Instruções antigas de zcashd não são recomendações de carteira aqui.') },
] as const;
export type SourceId = (typeof sources)[number]['id'];
export type Narrative = {
  id: string; title: Localized; idea: Localized; context: Localized; fact: Localized; limit: Localized;
  sources: SourceId[]; examplePitch: string; next: { href: string; label: Localized };
};
export const narratives: Narrative[] = [
  { id: 'cash', title: localized('The Cash Analogy', 'A analogia do dinheiro em espécie'),
    idea: localized('Pay someone without making the payment everyone’s business.', 'Pagar alguém sem transformar o pagamento em assunto de todos.'),
    context: localized('Start here for everyday payments, work and small businesses.', 'Comece aqui para pagamentos cotidianos, trabalho e pequenos negócios.'),
    fact: localized('Fully shielded transfers conceal sender, recipient and amount from the public blockchain. Transparent transfers do not offer that protection.', 'Transferências totalmente shielded ocultam remetente, destinatário e valor na blockchain pública. Transferências transparentes não oferecem essa proteção.'),
    limit: localized('Cash is an analogy, not an identical system. Transactions have fees and take time to confirm. Not all digital payments are public; bank records, for example, are not public blockchains.', 'Dinheiro em espécie é uma analogia, não um sistema idêntico. Transações têm taxas e levam tempo para confirmar. Nem todo pagamento digital é público; registros bancários, por exemplo, não são blockchains públicas.'),
    sources: ['use', 'shielded', 'privacy'], examplePitch: 'cash-online', next: { href: '/wallets/find', label: localized('Explore wallets', 'Explorar carteiras') } },
  { id: 'bitcoin', title: localized('“Bitcoin, But Private”', '“Bitcoin, mas privado”'),
    idea: localized('Begin with peer-to-peer money, then introduce a different privacy design.', 'Comece pelo dinheiro entre pessoas e apresente outro desenho de privacidade.'),
    context: localized('For people who already understand Bitcoin or want to discuss scarcity.', 'Para quem já entende Bitcoin ou quer discutir escassez.'),
    fact: localized('ZEC is a separate currency. Its monetary rules cap supply at 21 million ZEC; issuance is not yet zero. Shielding and scarcity are different properties.', 'ZEC é outra moeda. Suas regras monetárias limitam a oferta a 21 milhões de ZEC; a emissão ainda não é zero. Proteção shielded e escassez são propriedades diferentes.'),
    limit: localized('Zcash is not BTC with a setting enabled. A public address does not by itself reveal a legal identity or every holding. A supply cap guarantees neither demand nor price.', 'Zcash não é BTC com uma configuração ativada. Um endereço público, sozinho, não revela identidade civil nem todos os fundos. Um limite de oferta não garante demanda nem preço.'),
    sources: ['shielded', 'supply', 'protocol'], examplePitch: 'bitcoin-with-privacy', next: { href: '/zcash-network', label: localized('Explore the network', 'Explorar a rede') } },
  { id: 'cryptography', title: localized('The Technical / Cryptographic Explainer', 'A explicação técnica / criptográfica'),
    idea: localized('Verification need not require disclosure of the private inputs.', 'Verificar não precisa exigir a divulgação das entradas privadas.'),
    context: localized('Developer education and conversations about how a private payment can still be valid.', 'Educação de desenvolvedores e conversas sobre como um pagamento privado ainda pode ser válido.'),
    fact: localized('Zero-knowledge proofs work with signatures, commitments and nullifiers in the protocol. Together these checks enforce transaction rules without publishing the shielded payment details.', 'Provas de conhecimento zero trabalham com assinaturas, compromissos e identificadores de gasto no protocolo. Juntas, essas verificações aplicam as regras sem publicar os detalhes do pagamento shielded.'),
    limit: localized('A proof does not certify identity, intent or the security of a device. Cryptographic privacy is not a claim of absolute anonymity or quantum resistance.', 'Uma prova não certifica identidade, intenção ou segurança do dispositivo. Privacidade criptográfica não é uma afirmação de anonimato absoluto ou resistência quântica.'),
    sources: ['proofs', 'protocol'], examplePitch: 'verify-without-exposing', next: { href: 'https://zips.z.cash/protocol/protocol.pdf', label: localized('Read the protocol', 'Ler o protocolo') } },
  { id: 'freedom', title: localized('Freedom, Sovereignty & Human Rights', 'Liberdade, soberania e direitos humanos'),
    idea: localized('Financial privacy gives people room to choose what they share.', 'Privacidade financeira dá às pessoas espaço para escolher o que compartilham.'),
    context: localized('Donations, paid work and discussions about personal autonomy.', 'Doações, trabalho remunerado e discussões sobre autonomia pessoal.'),
    fact: localized('Shielded payments can keep sensitive transaction data out of public view. Self-custody gives the key holder responsibility for access to funds.', 'Pagamentos shielded podem manter dados sensíveis fora da visão pública. A autocustódia dá ao titular das chaves responsabilidade pelo acesso aos fundos.'),
    limit: localized('Freedom is a value expressed by contributors, not a protocol guarantee of safety. Devices, services, coercion and information disclosed elsewhere can still affect a person.', 'Liberdade é um valor expresso por colaboradores, não uma garantia de segurança do protocolo. Dispositivos, serviços, coerção e informações divulgadas em outros lugares ainda podem afetar uma pessoa.'),
    sources: ['use', 'protocol', 'privacy'], examplePitch: 'donate-with-dignity', next: { href: '/communities', label: localized('Find communities', 'Encontrar comunidades') } },
  { id: 'disclosure', title: localized('Compliance-Friendly / Selective Disclosure', 'Conformidade / divulgação seletiva'),
    idea: localized('Confidentiality and chosen access to records can coexist.', 'Confidencialidade e acesso escolhido aos registros podem coexistir.'),
    context: localized('Organizations explaining how private payments relate to reporting.', 'Organizações explicando como pagamentos privados se relacionam à prestação de contas.'),
    fact: localized('Viewing keys can reveal information without granting spending authority. Incoming and full viewing keys expose different information; software and pool support matter.', 'Chaves de visualização podem revelar informações sem dar poder de gasto. Chaves de recebimento e completas expõem informações diferentes; suporte do software e do pool importa.'),
    limit: localized('Sharing a key can reveal a broad history and future activity, not just a chosen receipt. Disclosure cannot undo what a recipient has learned. It does not automatically meet accounting or legal requirements.', 'Compartilhar uma chave pode revelar um histórico amplo e atividade futura, não só um recibo escolhido. Não é possível desfazer o que o destinatário já aprendeu. Isso não atende automaticamente a exigências contábeis ou legais.'),
    sources: ['protocol', 'keys', 'privacy'], examplePitch: 'selective-disclosure', next: { href: '/zcg', label: localized('Explore public reporting', 'Explorar prestação de contas pública') } },
  { id: 'metaphors', title: localized('Other Metaphors & Analogies', 'Outras metáforas e analogias'),
    idea: localized('Use a familiar picture, then explain where it stops working.', 'Use uma imagem familiar e depois explique onde ela deixa de funcionar.'),
    context: localized('An envelope can help a new audience picture confidentiality before cryptography.', 'Um envelope pode ajudar iniciantes a visualizar confidencialidade antes da criptografia.'),
    fact: localized('Shielding changes what payment information appears publicly. The network still has transaction records and checks validity.', 'A proteção shielded muda quais informações do pagamento aparecem publicamente. A rede ainda tem registros das transações e verifica sua validade.'),
    limit: localized('“Incognito mode” is not network anonymity. “Swiss bank account” does not mean a bank, deposit insurance or guaranteed secrecy. “Digital gold” is not a price forecast.', '“Modo anônimo” não é anonimato de rede. “Conta suíça” não significa banco, seguro de depósitos ou sigilo garantido. “Ouro digital” não é previsão de preço.'),
    sources: ['shielded', 'protocol', 'privacy'], examplePitch: 'sealed-envelope', next: { href: 'https://z.cash/learn/', label: localized('Learn the basics', 'Aprender o básico') } },
  { id: 'taglines', title: localized('Short Taglines', 'Frases curtas'),
    idea: localized('A memorable opening should lead to a more precise explanation.', 'Uma abertura memorável deve levar a uma explicação mais precisa.'),
    context: localized('Slides, event materials and short community posts.', 'Slides, materiais de eventos e publicações curtas da comunidade.'),
    fact: localized('Zcash supports both shielded and transparent payments. Even a short introduction should make room for this distinction.', 'Zcash oferece pagamentos shielded e transparentes. Mesmo uma apresentação curta deve abrir espaço para essa distinção.'),
    limit: localized('We do not recommend slogans claiming “untraceable”, “instant”, “no inflation” or “quantum cash”. None is established by the evidence cited here. Brevity is not a reason to promise more.', 'Não recomendamos slogans que afirmem “irrastreável”, “instantâneo”, “sem inflação” ou “dinheiro quântico”. Nenhum é estabelecido pelas evidências citadas aqui. Brevidade não justifica prometer mais.'),
    sources: ['use', 'supply', 'protocol'], examplePitch: 'privacy-in-one-line', next: { href: '/narratives?view=pitches', label: localized('Choose a longer pitch', 'Escolher um pitch mais longo') } },
  { id: 'surveillance', title: localized('The AI-Era Surveillance Threat', 'A ameaça da vigilância na era da IA'),
    idea: localized('Publish less sensitive data in the first place.', 'Publique menos dados sensíveis desde o início.'),
    context: localized('Data minimization and the consequences of linking public financial histories.', 'Minimização de dados e consequências de conectar históricos financeiros públicos.'),
    fact: localized('Shielding protects payment details on the blockchain. Network metadata and information given to third parties are separate sources of exposure.', 'A proteção shielded resguarda detalhes na blockchain. Metadados de rede e informações entregues a terceiros são fontes separadas de exposição.'),
    limit: localized('This is a community framing, not a benchmark of AI capabilities. Zcash does not control all your data, erase past disclosures or stop every form of profiling.', 'Este é um enquadramento comunitário, não uma medição de capacidades da IA. Zcash não controla todos os seus dados, não apaga divulgações anteriores nem impede toda criação de perfis.'),
    sources: ['shielded', 'privacy'], examplePitch: 'less-data-to-profile', next: { href: 'https://zcash.readthedocs.io/en/master/rtd_pages/privacy_recommendations_best_practices.html', label: localized('Understand privacy limits', 'Entender os limites de privacidade') } },
];
export type Pitch = {
  id: string; theme: string; audiences: Audience[]; sourceCells: string[]; author: string | null;
  kind: 'editorial-adaptation'; reviewStatus: 'reviewed'; reviewedAt: string;
  title: Localized; context: Localized; approach: Localized;
  translations: Record<Locale, Record<PitchLength, string>>;
};
export const pitches = rawPitches as Pitch[];
export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function filterPitches({ locale, query = '', audience = '', theme = '' }: { locale: Locale; query?: string; audience?: string; theme?: string }) {
  const terms = normalize(query).trim().split(/\s+/);
  return pitches.filter(p => {
    const family = narratives.find(n => n.id === p.theme)!;
    const text = normalize([p.title[locale], p.context[locale], p.approach[locale], family.title[locale], p.author ?? '', ...p.audiences.map(a => audiences[a][locale]), ...Object.values(p.translations[locale])].join(' '));
    return (!audience || p.audiences.includes(audience as Audience)) && (!theme || p.theme === theme) && terms.every(t => text.includes(t));
  });
}
export type View = 'pitches' | 'narratives';
export function readState(params: URLSearchParams) {
  const locale: Locale = locales.includes(params.get('lang') as Locale) ? params.get('lang') as Locale : 'en';
  const length: PitchLength = lengths.includes(params.get('length') as PitchLength) ? params.get('length') as PitchLength : '30s';
  const view: View = params.get('view') === 'narratives' ? 'narratives' : 'pitches';
  return { locale, length, view, query: params.get('q') ?? '', audience: Object.hasOwn(audiences, params.get('audience') ?? '') ? params.get('audience')! : '', theme: narratives.some(n => n.id === params.get('theme')) ? params.get('theme')! : '' };
}
export function contentHref(id: string, locale: Locale, length: PitchLength = '30s', view: View = 'pitches') {
  return `/narratives?lang=${locale}&length=${length}&view=${view}#${view === 'narratives' ? 'narrative' : 'pitch'}-${id}`;
}
