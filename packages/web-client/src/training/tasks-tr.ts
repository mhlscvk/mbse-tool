// Turkish overrides for training task text.
// SysML notation (keywords like `part def`, `:>`, `attribute`) stays English.
// Identifier names (Vehicle, Engine, mass, ...) are translated automatically
// via IDENTIFIER_MAP_TR — the loader in tasks.ts applies this map to
// starterCode/targetCode and reverse-applies it to user input before
// validation. Any task whose id is absent here falls back to the English
// text in tasks.ts.

import type { TrainingTask } from './tasks.js';

// SysML model identifier translations.
// ASCII-only names are used so word-boundary regex (`\b`) works reliably and
// the diagram-service parser cannot trip on unfamiliar Unicode letters.
// Keys must NOT include SysML keywords (part, def, attribute, port, item,
// enum, action, state, requirement, constraint, calc, package, import, use,
// case, view, viewpoint, allocation, occurrence, individual, snapshot,
// timeslice, metadata, concern, verification, analysis, rendering, alias,
// comment, doc, message, flow, in, out, inout, first, then, transition,
// satisfy, verify, allocate, fork, join, decide, merge, if, perform, exhibit,
// entry, do, exit, send, accept, event, bind, by, of, from, to, return,
// Real, Integer, Boolean, String, true, false, interface, connection).
export const IDENTIFIER_MAP_TR: Record<string, string> = {
  // ── Part definitions ──────────────────────────────────────────────────
  Vehicle: 'Arac',
  Engine: 'Motor',
  Wheel: 'Tekerlek',
  Chassis: 'Sasi',
  Transmission: 'Sanziman',
  BrakeSystem: 'FrenSistemi',
  Sensor: 'Algilayici',
  Piston: 'Piston',
  PoweredVehicle: 'MotorluArac',
  ElectricEngine: 'ElektrikliMotor',
  CombustionEngine: 'IctenYanmaliMotor',
  AlloyWheel: 'AlasimliJant',
  AutomaticTransmission: 'OtomatikSanziman',
  SportsCar: 'SporOtomobil',
  SmallVehicle: 'KucukArac',
  SmallEngine: 'KucukMotor',
  ElectricCar: 'ElektrikliOtomobil',
  TurboEngine: 'TurboMotor',
  BrakeDisc: 'FrenDiski',
  MassTest: 'KutleTesti',
  Driver: 'Surucu',
  Tank: 'Depo',
  Controller: 'Denetleyici',
  SystemModel: 'SistemModeli',

  // ── Port definitions ──────────────────────────────────────────────────
  FuelPort: 'YakitPortu',
  ElectricPort: 'ElektrikPortu',
  DataPort: 'VeriPortu',
  FuelingPort: 'YakitDoldurmaPortu',

  // ── Item definitions ──────────────────────────────────────────────────
  Fuel: 'Yakit',
  Electricity: 'Elektrik',
  ExhaustGas: 'EgzozGazi',
  Image: 'Goruntu',
  Torque: 'Tork',
  VehicleStart: 'AracBaslangici',
  ControlSignal: 'KontrolSinyali',

  // ── Connection / Interface / Flow definitions ────────────────────────
  FuelLine: 'YakitHatti',
  PowerInterface: 'GucArayuzu',
  FuelInterface: 'YakitArayuzu',
  FuelFlow: 'YakitAkisi',

  // ── Enumerations + their values ──────────────────────────────────────
  FuelType: 'YakitTipi',
  TransmissionMode: 'SanzimanModu',
  Color: 'Renk',
  Gasoline: 'Benzin',
  Diesel: 'Dizel',
  Manual: 'ManuelMod',
  Automatic: 'OtomatikMod',
  Red: 'Kirmizi',
  Blue: 'Mavi',
  Black: 'Siyah',
  White: 'Beyaz',
  Silver: 'Gumus',

  // ── Action definitions (UpperCamelCase) ──────────────────────────────
  StartEngine: 'MotoruCalistir',
  Accelerate: 'Hizlan',
  Cruise: 'SeyirHali',
  Brake: 'Frenle',
  DriveCycle: 'SurusDongusu',
  Launch: 'Firlat',
  Ignite: 'Atesle',
  Release: 'Birak',
  Abort: 'GoreviIptal',
  MissionControl: 'GorevKontrol',
  Drive: 'Sur',
  Generate: 'Uret',
  Amplify: 'Yukselt',
  Focus: 'Odakla',
  Shoot: 'Cek',
  Prepare: 'Hazirla',
  Execute: 'Yurut',
  HandleSuccess: 'BasariyiIsle',
  HandleFailure: 'HataIsle',
  CheckReady: 'HazirligiKontrol',
  StartProcess: 'IslemBaslat',
  ProcessNormal: 'NormalIsle',
  ProcessError: 'HataDurumunuIsle',
  TaskA: 'GorevA',
  TaskB: 'GorevB',
  Finalize: 'Sonlandir',
  StartVehicle: 'AraciCalistir',

  // ── State definitions ────────────────────────────────────────────────
  VehicleStates: 'AracDurumlari',
  TrafficLightStates: 'TrafikIsigiDurumlari',
  OperatingStates: 'CalismaDurumlari',
  // State usage names (lowercase) — careful: `state` is a keyword.
  off: 'kapali',
  idle: 'bosta',
  running: 'calisiyor',
  moving: 'hareketHalinde',
  stopped: 'durdu',
  // red/blue/etc as state names collide with enum values above (matching
  // case). That is fine because both map to the same Turkish identifier.

  // ── Requirements ─────────────────────────────────────────────────────
  MassRequirement: 'KutleGereksinimi',
  SpeedRequirement: 'HizGereksinimi',
  SafetyRequirement: 'GuvenlikGereksinimi',
  BrakingDistance: 'FrenlemeMesafesi',
  MassReq: 'KutleGereksinim',

  // ── Constraints ──────────────────────────────────────────────────────
  MassLimit: 'KutleSiniri',
  SpeedLimit: 'HizSiniri',
  EmergencyMassLimit: 'AcilKutleSiniri',

  // ── Calculations ─────────────────────────────────────────────────────
  TotalMass: 'ToplamKutle',
  SafetyFactor: 'GuvenlikFaktoru',

  // ── Packages ─────────────────────────────────────────────────────────
  VehicleDomain: 'AracAlani',
  Powertrain: 'GucAktarmaOrgani',
  Turbo: 'Turbo',
  Testing: 'TestPaketi',

  // ── Use cases / Views / Concerns ─────────────────────────────────────
  DriveToWork: 'IseGidisSurusu',
  HighwayDrive: 'OtoyolSurusu',
  EngineerView: 'MuhendisBakisi',
  SystemOverview: 'SistemGenelGorunum',
  Performance: 'Performans',
  DiagramView: 'DiyagramGorunumu',

  // ── Occurrences / Individual ─────────────────────────────────────────
  CrashEvent: 'CarpismaOlayi',
  Vehicle_1: 'Arac_1',

  // ── Attribute names (lowerCamelCase) ─────────────────────────────────
  mass: 'kutle',
  maxSpeed: 'maksimumHiz',
  horsepower: 'beygirGucu',
  cylinders: 'silindirler',
  diameter: 'cap',
  gearCount: 'vitesSayisi',
  isABS: 'absVarMi',
  material: 'malzeme',
  batteryCapacity: 'bataryaKapasitesi',
  octaneRating: 'oktanDerecesi',
  fuelType: 'yakitTipi',
  color: 'renk',
  mileage: 'kilometre',
  speed: 'hiz',
  location: 'konum',
  input: 'girdi',
  reading: 'okuma',
  bodyMass: 'govdeKutlesi',
  cargoMass: 'yukKutlesi',
  result: 'sonuc',
  loadCapacity: 'yukKapasitesi',
  actualLoad: 'mevcutYuk',
  factor: 'faktor',
  totalMass: 'toplamKutle',
  signal: 'sinyal',
  ignitionKey: 'kontakAnahtari',
  engineRunning: 'motorCalisiyor',
  fuelIn: 'yakitGiris',
  exhaustOut: 'egzozCikis',
  powerIn: 'gucGiris',
  dataOut: 'veriCikis',
  fuelOut: 'yakitCikis',
  fuelReturn: 'yakitDonus',
  torqueIn: 'torkGiris',
  torqueOut: 'torkCikis',

  // ── Usage names (lowerCamelCase) ─────────────────────────────────────
  eng: 'motor',
  trans: 'sanziman',
  brakes: 'frenler',
  piston: 'piston',
  disc: 'disk',
  frontWheel: 'onTekerlek',
  rearWheel: 'arkaTekerlek',
  leftFront: 'solOn',
  drivingWheel: 'cekisTekerlegi',
  turboPiston: 'turboPiston',
  smallEng: 'kucukMotor',
  sportWheel: 'sporTekerlek',
  raceEng: 'yarisMotor',
  raceWheel: 'yarisTekerlek',
  autoTrans: 'otomatikSanziman',
  fuelPort: 'yakitPortu',
  enginePort: 'motorPortu',
  engineFuel: 'motorYakit',
  fuelFlow: 'yakitAkis',
  generator: 'uretici',
  amplifier: 'yukseltici',
  providePower: 'gucSagla',
  takePicture: 'fotoCek',
  focus: 'odakla',
  shoot: 'cek',
  forkNode: 'catalDugum',
  joinNode: 'birlestirDugum',
  decideNode: 'kararDugumu',
  mergeNode: 'birlesimDugumu',
  decision1: 'karar1',
  processNormal: 'normalIsle',
  processError: 'hataDurumunuIsle',
  taskA: 'gorevA',
  taskB: 'gorevB',
  finalize: 'sonlandir',
  merge1: 'birlesim1',
  fork1: 'catal1',
  join1: 'birlestir1',
  prepare: 'hazirla',
  execute: 'yurut',
  handleSuccess: 'basariyiIsle',
  handleFailure: 'hataIsle',
  driverReady: 'suruculHazir',
  doorClosed: 'kapiKapali',
  turnOn: 'ac',
  waitForStart: 'baslamayiBekle',
  trip: 'seyahat',
  myVehicle: 'benimAracim',
  workflow: 'isAkisi',
  handler: 'islemci',
  vehicle: 'arac',
  engine: 'motor',
  tank: 'depo',
  controller: 'denetleyici',
  states: 'durumlar',
  vehicleStates: 'aracDurumlari',
  controlPort: 'kontrolPortu',
  startup: 'baslangic',
  shutdown: 'kapanis',
};

// ─── Comment phrase translations ─────────────────────────────────────────────
// Comments inside starterCode/targetCode templates only get identifier
// substitution by default — English prose like "Add this below:" or "<-- NEW"
// would otherwise leak into the Turkish UI. Keys are English; values keep
// English identifier names so the identifier map can substitute them after.
// Applied in tasks.ts before identifier substitution.
export const COMMENT_PHRASES_TR: Record<string, string> = {
  // Header lines
  '// Vehicle System — SysML v2 Training': '// Vehicle Sistemi — SysML v2 Eğitim',
  '// A «part def» defines a class of systems.': '// Bir «part def» sistem sınıfı tanımlar.',
  '// Spacecraft Mission — Behavioral Model': '// Uzay Aracı Görevi — Davranışsal Model',
  '// Spacecraft Launch — Concurrent Behaviors': '// Uzay Aracı Fırlatma — Eş Zamanlı Davranışlar',
  '// Vehicle States — Lifecycle Model': '// Vehicle Durumları — Yaşam Döngüsü Modeli',
  '// Vehicle Requirements Model': '// Vehicle Gereksinim Modeli',
  '// Vehicle Constraints Model': '// Vehicle Kısıt Modeli',
  '// System Architecture — Packages': '// Sistem Mimarisi — Paketler',
  '// System Usage & Allocation Model': '// Sistem Kullanım ve Atama Modeli',
  '// action def defines a step or behavior.': '// action def bir adımı veya davranışı tanımlar.',
  '// state def defines a state machine.': '// state def bir durum makinesi tanımlar.',

  // Inline hints (longer variants must precede shorter for split/join match order)
  '// <-- NEW (composition)': '// <-- YENİ (kompozisyon)',
  '// <-- NEW (redefines)': '// <-- YENİ (yeniden tanımlar)',
  '// <-- NEW definition': '// <-- YENİ tanım',
  '// <-- NEW usage': '// <-- YENİ kullanım',
  '// <-- UPDATED': '// <-- GÜNCELLENDİ',
  '// <-- NEW': '// <-- YENİ',

  // Placeholders
  '// ...existing definitions...': '// ...mevcut tanımlar...',
  '// ...existing parts...': '// ...mevcut parçalar...',
  '// ...existing defs...': '// ...mevcut tanımlar...',
  '// ...actions and first succession...': '// ...eylemler ve ilk ardışıklık...',

  // Concept notes
  '// :> means "specializes":': '// :> "özelleştirir" anlamına gelir:',
  '// :>> replaces the inherited eng': '// :>> miras alınan eng\'i değiştirir',
  '// Chained: SportsCar → PoweredVehicle → Vehicle': '// Zincirleme: SportsCar → PoweredVehicle → Vehicle',
  '// Add a port definition:': '// Bir port tanımı ekle:',
  '// Add this below:': '// Aşağıya ekle:',
  '// Traceability:': '// İzlenebilirlik:',

  // Completion banner
  '// SysML v2 Training Complete!': '// SysML v2 Eğitimi Tamamlandı!',
  '// You have mastered:': '// Şunlarda uzmanlaştınız:',
  '// - Part definitions & usages': '// - Parça tanımları ve kullanımları',
  '// - Attributes (Real, Integer, Boolean, String)': '// - Öznitelikler (Real, Integer, Boolean, String)',
  '// - Specialization (:>)': '// - Özelleştirme (:>)',
  '// - Composition & multiplicity': '// - Kompozisyon ve çokluk',
  '// - Subsetting (:> on usages)': '// - Alt küme (:> kullanımlarda)',
  '// - Redefinition (:>>)': '// - Yeniden tanımlama (:>>)',
  '// - Ports & directed features (in, out, inout)': '// - Portlar ve yönlü özellikler (in, out, inout)',
  '// - Items & connections': '// - Öğeler ve bağlantılar',
  '// - Enumerations': '// - Numaralandırmalar',
  '// - Actions, successions, fork/join, decide/merge': '// - Eylemler, ardışıklıklar, çatal/birleştir, karar/birleşim',
  '// - States & transitions': '// - Durumlar ve geçişler',
  '// - Requirements, satisfy, verify': '// - Gereksinimler, karşıla, doğrula',
  '// - Constraints & calculations': '// - Kısıtlar ve hesaplamalar',
  '// - Packages & imports': '// - Paketler ve içe aktarmalar',
  '// - Use cases, allocation, views & viewpoints': '// - Kullanım senaryoları, atama, görünümler ve bakış açıları',
  '// - Flows (streaming, succession, message)': '// - Akışlar (akış, ardışıklık, mesaj)',
  '// - Perform & exhibit (entry/do/exit actions)': '// - Yürüt ve sergile (entry/do/exit eylemleri)',
  '// - Comments, documentation, aliases': '// - Yorumlar, belgeler, takma adlar',
  '// - Conjugated ports, interfaces, bindings': '// - Eşlenik portlar, arayüzler, bağlamalar',
  '// - Conditional guards, if-then-else, fork/join/decide/merge': '// - Koşullu korumalar, if-then-else, çatal/birleştir/karar/birleşim',
  '// - Occurrences, event occurrences': '// - Oluşumlar, olay oluşumları',
  '// - Individual definitions, snapshots, timeslices, temporal modeling': '// - Bireysel tanımlar, anlık görüntüler, zaman dilimleri, zamansal modelleme',
};


type TaskTextOverride = Pick<
  TrainingTask,
  'levelName' | 'title' | 'instruction' | 'hint' | 'concept' | 'conceptExplanation'
> & {
  /** Replaces the English success message produced by the validate function. */
  validateSuccess?: string;
  /** Replaces the English error message produced by the validate function. */
  validateError?: string;
};

export const TASK_TEXTS_TR: Record<string, TaskTextOverride> = {

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 1: Part Definitions (6 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l1t1: {
    levelName: 'Parça Tanımları',
    title: 'İlk Parça Tanımınızı Oluşturun',
    instruction:
      'Bir **«part def»** sistem ya da sistem parçalarının sınıfını tanımlar.\n\n' +
      'Bu bir tiptir — örnek değil, bir şablon. Şablonu bir kez tanımlarsınız, sonra ondan istediğiniz kadar kullanım üretebilirsiniz.\n\n' +
      'Editörde zaten bir **Vehicle** tanımı var. **Engine** adında ikinci bir tanım ekleyin.',
    hint: 'Vehicle tanımının altına yeni bir satıra `part def Engine { }` yazın.',
    concept: '«part def»',
    conceptExplanation:
      'Bir Parça Tanımı yeniden kullanılabilir bir tip ilan eder. SysML v2\'de tipler (tanımlar) ' +
      've örnekler (kullanımlar) her zaman ayrı tutulur — bu tanım/kullanım örüntüsüdür. ' +
      'Diyagramda tanımlar köşeli dikdörtgenle gösterilir.',
    validateSuccess: 'Engine artık bir part tanımı — bir tip şablonu. Diyagramda yeni bir blok olarak görünür.',
    validateError: 'Yeni bir satıra `part def Engine { }` ekleyin.',
  },

  l1t2: {
    levelName: 'Parça Tanımları',
    title: 'Wheel Tanımı Ekle',
    instruction:
      'Bir aracın tekerleğe ihtiyacı var. Sistemdeki her kavram kendi Parça Tanımına sahip olur.\n\n' +
      '**Wheel** adında bir part tanımı ekleyin.',
    hint: 'Engine\'den sonra yeni bir satıra `part def Wheel { }` yazın.',
    concept: '«part def»',
    conceptExplanation:
      'Bu aşamada parça tanımları birbirinden bağımsızdır. Aralarındaki ilişkiler — kompozisyon, ' +
      'özelleştirme ve bağlantılar — sonraki seviyelerde gelir.',
    validateSuccess: 'Üç Parça Tanımı — her biri diyagramda bağımsız bir blok olarak görünür.',
    validateError: 'Yeni bir satıra `part def Wheel { }` ekleyin.',
  },

  l1t3: {
    levelName: 'Parça Tanımları',
    title: 'Chassis Tanımı Ekle',
    instruction:
      'Şasi aracın yapısal iskeletidir.\n\n' +
      '**Chassis** adında bir part tanımı ekleyin.',
    hint: 'Yeni bir satıra `part def Chassis { }` yazın.',
    concept: '«part def»',
    conceptExplanation:
      'Bir sistemdeki her önemli bileşen kendi tanımına sahip olmalıdır. ' +
      'Bu yeniden kullanılabilirliği sağlar — aynı Chassis tipi birçok araç tasarımında yer alabilir.',
    validateSuccess: 'Chassis eklendi. Şu an diyagramda dört blok görünüyor.',
    validateError: 'Yeni bir satıra `part def Chassis { }` ekleyin.',
  },

  l1t4: {
    levelName: 'Parça Tanımları',
    title: 'Transmission Tanımı Ekle',
    instruction:
      'Şanzıman, motordan tekerleklere gücü iletir.\n\n' +
      '**Transmission** adında bir part tanımı ekleyin.',
    hint: 'Yeni bir satıra `part def Transmission { }` yazın.',
    concept: '«part def»',
    conceptExplanation:
      'SysML v2\'de adlandırma kuralları: tanım adları PascalCase (UpperCamelCase) olur. ' +
      'Kullanım adları (örnekler) lowerCamelCase olur. Bu kural dilin tamamında tutarlıdır.',
    validateSuccess: 'Transmission eklendi. Beş bileşen tipi tanımlandı.',
    validateError: 'Yeni bir satıra `part def Transmission { }` ekleyin.',
  },

  l1t5: {
    levelName: 'Parça Tanımları',
    title: 'BrakeSystem Tanımı Ekle',
    instruction:
      'Güvenlik için her aracın frenleri olmalı.\n\n' +
      '**BrakeSystem** adında bir part tanımı ekleyin.',
    hint: 'Yeni bir satıra `part def BrakeSystem { }` yazın.',
    concept: '«part def»',
    conceptExplanation:
      'Birden çok kelimeli tanım adları PascalCase olur, boşluk ya da alt çizgi kullanılmaz. ' +
      'BrakeSystem, Brake_System veya brake system değil.',
    validateSuccess: 'Altı parça tanımı! Araç sisteminin tip kütüphanesi şekillenmeye başladı.',
    validateError: 'Yeni bir satıra `part def BrakeSystem { }` ekleyin.',
  },

  l1t6: {
    levelName: 'Parça Tanımları',
    title: 'Sensor Tanımı Ekle',
    instruction:
      'Modern araçlar pek çok sensöre sahiptir. Bir parça tanımı daha ekleyin.\n\n' +
      '**Sensor** adında bir part tanımı ekleyin.',
    hint: 'Yeni bir satıra `part def Sensor { }` yazın.',
    concept: '«part def»',
    conceptExplanation:
      'Artık yedi bağımsız tip şablonunuz var. Gerçek bir projede yüzlerce olabilir. ' +
      'SysML v2 paketleri (ileride ele alınıyor) bunları ad alanlarına göre düzenler.',
    validateSuccess: 'Yedi parça tanımı tamamlandı! Sonraki: bu tiplere özellik ekleyelim.',
    validateError: 'Yeni bir satıra `part def Sensor { }` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 2: Attributes (7 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l2t1: {
    levelName: 'Öznitelikler',
    title: 'Engine\'e Kütle Ekle',
    instruction:
      'Bir **attribute** (öznitelik), bir özelliği betimleyen tipli bir alandır.\n\n' +
      'İki nokta üst üste `:` adı tipinden ayırır — "şu tipte tanımlı" ilişkisi.\n\n' +
      '**Engine** içine: `attribute mass : Real;` ekleyin.',
    hint: 'İmleci Engine\'in `{` ve `}` arasına götürün, ardından `attribute mass : Real;` yazın.',
    concept: 'attribute',
    conceptExplanation:
      '"attribute mass : Real", Engine\'in Real tipinde mass adlı bir özelliği olduğu anlamına gelir. ' +
      'Yerleşik skaler tipler: Real, Integer, Boolean, String (ScalarValues kütüphanesinden).',
    validateSuccess: 'Engine artık öznitelik bölmesinde "mass : Real" gösteriyor.',
  },

  l2t2: {
    levelName: 'Öznitelikler',
    title: 'Wheel\'e Çap Ekle',
    instruction:
      'Öznitelikler fiziksel boyutları, performans parametrelerini veya yapılandırma değerlerini temsil eder.\n\n' +
      '**Wheel** içine: `attribute diameter : Real;` ekleyin.',
    hint: 'Wheel { } içine `attribute diameter : Real;` yazın.',
    concept: 'attribute',
    conceptExplanation:
      'Gerçek bir modelde SI kütüphanesinden birimler içe aktarılırdı (örn. ISQ::LengthValue). ' +
      'Eğitim için temel Real tipini kullanıyoruz.',
    validateSuccess: 'Wheel artık diameter özniteliğini gösteriyor.',
  },

  l2t3: {
    levelName: 'Öznitelikler',
    title: 'Vehicle\'a Maksimum Hız Ekle',
    instruction:
      'Vehicle\'ın kendisi de özniteliklere sahip olabilir.\n\n' +
      '**Vehicle** içine: `attribute maxSpeed : Real;` ekleyin.',
    hint: 'Vehicle { } içine `attribute maxSpeed : Real;` yazın.',
    concept: 'attribute',
    conceptExplanation:
      'Öznitelik adları lowerCamelCase olur — maxSpeed, MaxSpeed veya max_speed değil. ' +
      'Bu SysML v2 adlandırma kurallarına uyar.',
    validateSuccess: 'Vehicle artık bir maxSpeed özelliğine sahip.',
  },

  l2t4: {
    levelName: 'Öznitelikler',
    title: 'Integer Tipiyle Vites Sayısı Ekle',
    instruction:
      'Tüm öznitelikler Real sayı değildir. Tam sayı miktarlar için **Integer** kullanılır.\n\n' +
      '**Transmission** içine: `attribute gearCount : Integer;` ekleyin.',
    hint: 'Transmission { } içine `attribute gearCount : Integer;` yazın.',
    concept: 'attribute types',
    conceptExplanation:
      'SysML v2 skaler tipleri: Real (kayan nokta), Integer (tam sayı), ' +
      'Boolean (true/false), String (metin). Tipler ScalarValues standart kütüphanesinden gelir.',
    validateSuccess: 'gearCount Integer tipini kullanıyor — tam sayı değerleri için ideal.',
  },

  l2t5: {
    levelName: 'Öznitelikler',
    title: 'Boolean Öznitelik Ekle',
    instruction:
      '**Boolean** öznitelikler true/false bayraklarını temsil eder.\n\n' +
      '**BrakeSystem** içine: `attribute isABS : Boolean;` ekleyin.',
    hint: 'BrakeSystem { } içine `attribute isABS : Boolean;` yazın.',
    concept: 'Boolean type',
    conceptExplanation:
      'Boolean öznitelikler sistem yapılandırma bayrakları için kullanışlıdır. ' +
      'isABS, fren sisteminin Anti-Lock Braking System (ABS) özelliğine sahip olup olmadığını belirtir.',
    validateSuccess: 'BrakeSystem ABS yeteneği için bir Boolean bayrağa sahip.',
  },

  l2t6: {
    levelName: 'Öznitelikler',
    title: 'String Öznitelik Ekle',
    instruction:
      '**String** öznitelikler metin değerleri tutar.\n\n' +
      '**Chassis** içine: `attribute material : String;` ekleyin.',
    hint: 'Chassis { } içine `attribute material : String;` yazın.',
    concept: 'String type',
    conceptExplanation:
      'String öznitelikler metinsel veri saklar — adlar, açıklamalar, kimlikler veya malzeme türleri. ' +
      'Kısıtlı metin değerleri için sayım türleri (enum, ileride ele alınıyor) tercih edilir.',
    validateSuccess: 'Chassis artık malzeme bilgisini takip ediyor. Dört skaler tipi de kullandınız!',
  },

  l2t7: {
    levelName: 'Öznitelikler',
    title: 'Birden Fazla Öznitelik Ekle',
    instruction:
      'Bir tanım birden fazla özniteliğe sahip olabilir. **Engine**\'e **iki** öznitelik ekleyin:\n\n' +
      '- `attribute horsepower : Real;`\n' +
      '- `attribute cylinders : Integer;`',
    hint: 'Engine { } içinde mass özniteliğinden sonra iki satırı da ekleyin.',
    concept: 'multiple attributes',
    conceptExplanation:
      'Tanımlar gereken sayıda özniteliğe sahip olabilir. Her biri tipin farklı bir özelliğini açıklar. ' +
      'Birlikte diyagram gösterimindeki "öznitelik bölmesini" oluştururlar.',
    validateSuccess: 'Engine artık mass, horsepower ve cylinders özniteliklerine sahip. Öznitelikler bitti!',
    validateError: 'Engine { } içine ekleyin: `attribute horsepower : Real;` ve `attribute cylinders : Integer;`',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 3: Specialization (7 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l3t1: {
    levelName: 'Özelleştirme',
    title: 'Vehicle\'ı Özelleştir',
    instruction:
      '**`:>`** operatörü "özelleştirir" anlamına gelir — bir şeyin daha özel bir türü.\n\n' +
      'Özelleştirilmiş bir tanım, genel tanımının tüm özelliklerini miras alır.\n\n' +
      '`part def PoweredVehicle :> Vehicle { }` ekleyin — güç kaynağı olan bir araç.',
    hint: 'Yeni bir satıra `part def PoweredVehicle :> Vehicle { }` yazın.',
    concept: 'Specialization :>',
    conceptExplanation:
      ':> "specializes" anahtar sözcüğüyle eşdeğerdir. PoweredVehicle, Vehicle\'dan maxSpeed\'i miras alır. ' +
      'Diyagramda özelleştirilmiş taraftan genele doğru, içi boş üçgen başlı düz bir ok çizilir.',
    validateSuccess: 'PoweredVehicle\'dan Vehicle\'a bir özelleştirme oku gider. maxSpeed\'i miras alır.',
    validateError: 'Yeni bir satıra `part def PoweredVehicle :> Vehicle { }` ekleyin.',
  },

  l3t2: {
    levelName: 'Özelleştirme',
    title: 'Engine\'i Özelleştir — Elektrik',
    instruction:
      'Motorlar farklı türlerde olur. Elektrikli bir varyant oluşturun.\n\n' +
      '`part def ElectricEngine :> Engine { }` ekleyin.',
    hint: 'Yeni bir satıra `part def ElectricEngine :> Engine { }` yazın.',
    concept: 'Specialization :>',
    conceptExplanation:
      'ElectricEngine, Engine\'den mass, horsepower ve cylinders\'ı miras alır. ' +
      'Özelleştirilmiş tanıma yeni öznitelik ekleyebilir veya miras alınanları geçersiz kılabilirsiniz.',
    validateSuccess: 'ElectricEngine, Engine\'i özelleştirir — Engine\'in tüm özniteliklerini miras alır.',
    validateError: 'Yeni bir satıra `part def ElectricEngine :> Engine { }` ekleyin.',
  },

  l3t3: {
    levelName: 'Özelleştirme',
    title: 'Engine\'i Özelleştir — İçten Yanmalı',
    instruction:
      'İçten yanmalı motorlar için başka bir Engine özelleştirmesi oluşturun.\n\n' +
      '`part def CombustionEngine :> Engine { }` ekleyin.',
    hint: 'Yeni bir satıra `part def CombustionEngine :> Engine { }` yazın.',
    concept: 'Specialization :>',
    conceptExplanation:
      'Birden fazla tanım aynı genel tanımı özelleştirebilir. ' +
      'Hem ElectricEngine hem de CombustionEngine birer Engine türüdür.',
    validateSuccess: 'İki Engine özelleştirmesi — ElectricEngine ve CombustionEngine. İkisi de Engine\'in özniteliklerini miras alır.',
    validateError: 'Yeni bir satıra `part def CombustionEngine :> Engine { }` ekleyin.',
  },

  l3t4: {
    levelName: 'Özelleştirme',
    title: 'Wheel\'i Özelleştir',
    instruction:
      'Alüminyum alaşımlı jantlar için özelleştirilmiş bir wheel tipi oluşturun.\n\n' +
      '`part def AlloyWheel :> Wheel { }` ekleyin.',
    hint: 'Yeni bir satıra `part def AlloyWheel :> Wheel { }` yazın.',
    concept: 'Specialization :>',
    conceptExplanation:
      'Özelleştirme hiyerarşileri istediğiniz kadar derin olabilir. ' +
      'İleride daha fazla özelleştirme için PerformanceAlloyWheel :> AlloyWheel oluşturabilirsiniz.',
    validateSuccess: 'AlloyWheel, Wheel\'den diameter\'ı miras alır.',
    validateError: 'Yeni bir satıra `part def AlloyWheel :> Wheel { }` ekleyin.',
  },

  l3t5: {
    levelName: 'Özelleştirme',
    title: 'Transmission\'ı Özelleştir',
    instruction:
      'Otomatik şanzıman için özelleştirilmiş bir transmission oluşturun.\n\n' +
      '`part def AutomaticTransmission :> Transmission { }` ekleyin.',
    hint: 'Yeni bir satıra `part def AutomaticTransmission :> Transmission { }` yazın.',
    concept: 'Specialization :>',
    conceptExplanation:
      'Özelleştirilmiş tanımlar alt tipe özgü öznitelikler ekleyebilir. ' +
      'AutomaticTransmission gearCount\'u miras alır ve shiftSpeed gibi öznitelikler ekleyebilir.',
    validateSuccess: 'AutomaticTransmission, Transmission\'dan gearCount\'u miras alır.',
    validateError: 'Yeni bir satıra `part def AutomaticTransmission :> Transmission { }` ekleyin.',
  },

  l3t6: {
    levelName: 'Özelleştirme',
    title: 'Zincirleme Özelleştirme',
    instruction:
      'Özelleştirme zincirlenebilir. PoweredVehicle zaten Vehicle\'ı özelleştiriyor.\n\n' +
      '`part def SportsCar :> PoweredVehicle { }` ekleyin — zincir: SportsCar → PoweredVehicle → Vehicle.',
    hint: 'Yeni bir satıra `part def SportsCar :> PoweredVehicle { }` yazın.',
    concept: 'chained specialization',
    conceptExplanation:
      'SportsCar :> PoweredVehicle :> Vehicle bir kalıtım zinciri oluşturur. ' +
      'SportsCar, hem PoweredVehicle\'ın hem de Vehicle\'ın (maxSpeed) tüm özelliklerini miras alır.',
    validateSuccess: 'SportsCar → PoweredVehicle → Vehicle: üç seviyeli bir kalıtım zinciri!',
    validateError: 'Yeni bir satıra `part def SportsCar :> PoweredVehicle { }` ekleyin.',
  },

  l3t7: {
    levelName: 'Özelleştirme',
    title: 'Özelleştirmeye Öznitelik Ekle',
    instruction:
      'Özelleştirilmiş tanımlar, miras aldıklarına ek olarak yeni öznitelikler ekleyebilir.\n\n' +
      '**ElectricEngine** içine: `attribute batteryCapacity : Real;` ekleyin.\n\n' +
      'Bu öznitelik yalnızca ElectricEngine\'de bulunur, Engine\'de değil.',
    hint: 'ElectricEngine { } içine `attribute batteryCapacity : Real;` yazın.',
    concept: 'extending specializations',
    conceptExplanation:
      'Özelleştirilmiş bir tanım tüm miras alınan özelliklere artı eklediğiniz yeni özelliklere sahiptir. ' +
      'Engine\'in mass/horsepower\'ı vardır. ElectricEngine\'in mass/horsepower VE batteryCapacity\'si vardır.',
    validateSuccess: 'ElectricEngine artık miras aldığı mass ve horsepower\'a ek olarak batteryCapacity\'ye de sahip.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 4: Composition & Multiplicity (8 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l4t1: {
    levelName: 'Kompozisyon',
    title: 'Vehicle\'a Engine Ekle',
    instruction:
      'Bir tanım içindeki **parça kullanımı** kompozisyon oluşturur — "Vehicle bir Engine *içerir*".\n\n' +
      'İki nokta üst üste `:` "şu tipte tanımlı" anlamına gelir — kullanımı bir tanımla tipler.\n\n' +
      '**Vehicle** içine: `part eng : Engine;` ekleyin.',
    hint: 'Vehicle { } içinde özniteliğin altına: `part eng : Engine;` ekleyin.',
    concept: '«part» usage',
    conceptExplanation:
      '"part eng : Engine", Vehicle\'ın tam olarak bir Engine içerdiği anlamına gelir (varsayılan çokluk 1\'dir). ' +
      'Kompozisyon en güçlü sahipliktir — parçanın yaşam döngüsü sahibine bağlıdır.',
    validateSuccess: 'Vehicle artık bir Engine içeriyor — diyagramda eng, Vehicle\'ın içinde iç içe görünür.',
  },

  l4t2: {
    levelName: 'Kompozisyon',
    title: 'Çoklukla Tekerlek Ekle',
    instruction:
      '**Çokluk** kaç örnek olduğunu belirler. `[4]` tam olarak dört demektir.\n\n' +
      '**Vehicle** içine: `part wheel[4] : Wheel;` ekleyin.',
    hint: 'Vehicle { } içine: `part wheel[4] : Wheel;` ekleyin.',
    concept: 'multiplicity [n]',
    conceptExplanation:
      '[4] tam olarak dört Wheel örneği demektir. Diğer biçimler: [1..*] bir veya daha fazla, ' +
      '[0..1] isteğe bağlı, [*] üst sınırsız. Parça kullanımları için varsayılan çokluk 1\'dir.',
    validateSuccess: 'Vehicle\'ın dört tekerleği var! [4] çokluğu tam olarak dört örnek demek.',
    validateError: 'Vehicle { } içine: `part wheel[4] : Wheel;` ekleyin.',
  },

  l4t3: {
    levelName: 'Kompozisyon',
    title: 'Vehicle\'a Chassis Ekle',
    instruction:
      'Vehicle kompozisyonunu oluşturmaya devam edin.\n\n' +
      '**Vehicle** içine: `part chassis : Chassis;` ekleyin.',
    hint: 'Vehicle { } içine: `part chassis : Chassis;` ekleyin.',
    concept: '«part» usage',
    conceptExplanation:
      'Her parça kullanımı bir sahiplik bağı oluşturur. Vehicle artık eng, wheel[4] ve chassis\'e sahip. ' +
      'İç içe görünüm bunları Vehicle içinde içerilmiş bloklar olarak gösterir.',
    validateSuccess: 'Vehicle artık bir Chassis\'e sahip. Vehicle içinde üç parça var.',
  },

  l4t4: {
    levelName: 'Kompozisyon',
    title: 'Vehicle\'a Transmission Ekle',
    instruction:
      '**Vehicle** içine: `part trans : Transmission;` ekleyin.',
    hint: 'Vehicle { } içine: `part trans : Transmission;` ekleyin.',
    concept: '«part» usage',
    conceptExplanation:
      'Kullanım adları genellikle kısaltılır: Engine için eng, Transmission için trans. ' +
      'Bu modeli özlü tutarken okunabilirliği korur.',
    validateSuccess: 'Vehicle artık bir Transmission içeriyor. İçeride dört parça var.',
  },

  l4t5: {
    levelName: 'Kompozisyon',
    title: 'Vehicle\'a BrakeSystem Ekle',
    instruction:
      '**Vehicle** içine: `part brakes : BrakeSystem;` ekleyin.',
    hint: 'Vehicle { } içine: `part brakes : BrakeSystem;` ekleyin.',
    concept: '«part» usage',
    conceptExplanation:
      'Kullanım adı (brakes) tanım adından (BrakeSystem) bağımsızdır. ' +
      'Tipin kullanıldığı her bağlam için açıklayıcı adlar seçersiniz.',
    validateSuccess: 'Vehicle tamamen oluştu: eng, wheel[4], chassis, trans, brakes.',
  },

  l4t6: {
    levelName: 'Kompozisyon',
    title: 'Engine İçine Parça Yerleştir',
    instruction:
      'Kompozisyon iç içe geçebilir — parçalar parçalar içerebilir.\n\n' +
      'Önce yeni bir tanım olarak `part def Piston { }` ekleyin, sonra **Engine** içine: `part piston[4] : Piston;` ekleyin.',
    hint: '`part def Piston { }` ekleyin, sonra Engine içine `part piston[4] : Piston;` ekleyin.',
    concept: 'nested composition',
    conceptExplanation:
      'Derin iç içe yerleşim, sistemin fiziksel hiyerarşisini modeller. ' +
      'Vehicle → Engine → Piston üç içerme seviyesini temsil eder.',
    validateSuccess: 'Engine artık 4 piston içeriyor. İç içe kompozisyon: Vehicle → Engine → Piston.',
    validateError: '`part def Piston { }` ekleyin ve Engine içine `part piston[4] : Piston;` ekleyin.',
  },

  l4t7: {
    levelName: 'Kompozisyon',
    title: 'Değişken Çoklukla Sensör Ekle',
    instruction:
      'Bir veya daha fazla çokluk için `[1..*]` kullanın.\n\n' +
      '**Vehicle** içine: `part sensor[1..*] : Sensor;` ekleyin.\n\n' +
      'Henüz yoksa `part def Sensor { }` da ekleyin.',
    hint: 'Vehicle { } içine: `part sensor[1..*] : Sensor;` ekleyin.',
    concept: 'variable multiplicity',
    conceptExplanation:
      '[1..*] "en az bir, üst sınır yok" demek. Diğer biçimler: [0..*] veya [*] sıfır veya daha fazla, ' +
      '[0..1] isteğe bağlı. Aralık çoklukları modele esneklik kazandırır.',
    validateSuccess: 'Değişken çokluk [1..*] — en az bir sensör, üst sınır yok.',
    validateError: 'Vehicle { } içine: `part sensor[1..*] : Sensor;` ekleyin.',
  },

  l4t8: {
    levelName: 'Kompozisyon',
    title: 'BrakeSystem İçine BrakeDisc Ekle',
    instruction:
      'Fren diskleri için yeni bir tanım ve kullanım ekleyin.\n\n' +
      '`part def BrakeDisc { }` ekleyin, sonra **BrakeSystem** içine: `part disc[4] : BrakeDisc;` ekleyin.',
    hint: '`part def BrakeDisc { }` ekleyin, sonra BrakeSystem içine `part disc[4] : BrakeDisc;` ekleyin.',
    concept: 'nested composition',
    conceptExplanation:
      'Sistem hiyerarşisi derinleşir: Vehicle → BrakeSystem → BrakeDisc. ' +
      'Her iç içe seviye gerçek sistemdeki fiziksel içermeyi temsil eder.',
    validateSuccess: 'BrakeSystem artık 4 fren diski içeriyor. Kompozisyon ustalaştı!',
    validateError: '`part def BrakeDisc { }` ekleyin ve BrakeSystem içine `part disc[4] : BrakeDisc;` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 5: Subsetting (5 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l5t1: {
    levelName: 'Alt-Kümeleme',
    title: 'Tekerlek Özelliğini Alt-Kümele',
    instruction:
      '**Alt-kümeleme** (kullanımlar üzerinde `:>`) "bu özelliğin değerleri başka bir özelliğin değerlerinin alt kümesidir" anlamına gelir.\n\n' +
      'PoweredVehicle, Vehicle\'dan `wheel[4]`\'ü miras alır. Daha özel bir tekerlek ilan edin.\n\n' +
      'Gerekirse önce `part def PoweredVehicle :> Vehicle { }` ekleyin, sonra içine: `part frontWheel :> wheel;` ekleyin.',
    hint: 'PoweredVehicle { } içine `part frontWheel :> wheel;` yazın.',
    concept: 'Subsetting :>',
    conceptExplanation:
      ':> bir kullanım üzerinde (tanım üzerinde değil) "alt-kümeler" anlamına gelir. ' +
      '"frontWheel, wheel\'in bir alt kümesidir" — PoweredVehicle\'ın bulunduğu her bağlamda ' +
      'frontWheel değerleri wheel değerlerinin içindedir.',
    validateSuccess: 'frontWheel, miras alınan wheel\'i alt-kümeler. Aralarında bir alt-kümeleme oku bulunur.',
  },

  l5t2: {
    levelName: 'Alt-Kümeleme',
    title: 'Başka Bir Alt-Küme Ekle',
    instruction:
      'Arka tekerlekler için ikinci bir alt-küme ekleyin.\n\n' +
      '**PoweredVehicle** içine: `part rearWheel :> wheel;` ekleyin.',
    hint: 'PoweredVehicle { } içine `part rearWheel :> wheel;` ekleyin.',
    concept: 'multiple subsets',
    conceptExplanation:
      'Birden fazla özellik aynı üst özelliği alt-kümeleyebilir. frontWheel ve rearWheel ' +
      'her ikisi de wheel\'in alt kümesidir — dört tekerleği isimlendirilmiş gruplara ayırırlar.',
    validateSuccess: 'wheel\'in iki alt kümesi: frontWheel ve rearWheel.',
  },

  l5t3: {
    levelName: 'Alt-Kümeleme',
    title: 'Zincirleme Alt-Kümeleme',
    instruction:
      'Alt-kümeleme zincirlenebilir. Bir alt kümenin alt kümesini oluşturun.\n\n' +
      '**PoweredVehicle** içine: `part leftFront :> frontWheel;` ekleyin.\n\n' +
      'Bu, leftFront ⊂ frontWheel ⊂ wheel anlamına gelir.',
    hint: 'PoweredVehicle { } içine `part leftFront :> frontWheel;` ekleyin.',
    concept: 'chained subsetting',
    conceptExplanation:
      'leftFront, frontWheel\'i alt-kümeler; frontWheel ise wheel\'i alt-kümeler. ' +
      'Bu bir hiyerarşi oluşturur: leftFront değerleri frontWheel değerlerinde, onlar da wheel değerlerinde bulunur.',
    validateSuccess: 'Zincirleme: leftFront ⊂ frontWheel ⊂ wheel. Üç seviyeli alt-kümeleme!',
  },

  l5t4: {
    levelName: 'Alt-Kümeleme',
    title: 'SportsCar İçinde Alt-Kümele',
    instruction:
      'Şimdi SportsCar\'da alt-kümeleme ekleyin (PoweredVehicle :> Vehicle\'ı özelleştiriyor).\n\n' +
      '`part def SportsCar :> PoweredVehicle { }` ekleyin ve içine `part drivingWheel :> rearWheel;` ekleyin.',
    hint: '`part def SportsCar :> PoweredVehicle { part drivingWheel :> rearWheel; }` ekleyin.',
    concept: 'subsetting in subtypes',
    conceptExplanation:
      'SportsCar, PoweredVehicle\'ın (ve onun da Vehicle\'dan miras aldığı) tüm özelliklerini miras alır. ' +
      'Alt tipte alt-kümeleme, miras alınan hiyerarşiyi daha da inceltir.',
    validateSuccess: 'SportsCar\'da rearWheel\'i alt-kümeleyen drivingWheel var — arkadan itişli spor araba!',
    validateError: '`part def SportsCar :> PoweredVehicle { part drivingWheel :> rearWheel; }` ekleyin.',
  },

  l5t5: {
    levelName: 'Alt-Kümeleme',
    title: 'Engine Parçalarını Alt-Kümele',
    instruction:
      'Alt-kümeleme sadece tekerleklerde değil, herhangi bir parça kullanımında çalışır.\n\n' +
      'Yeni bir `part def TurboEngine :> Engine { }` içine: `part turboPiston :> piston;` ekleyin.\n\n' +
      '(Engine\'in `part piston[4] : Piston;` özelliği var — gerekirse ekleyin.)',
    hint: '`part def TurboEngine :> Engine { part turboPiston :> piston; }` ekleyin.',
    concept: 'subsetting non-wheel features',
    conceptExplanation:
      'Alt-kümeleme yalnızca belirli bir tipe değil, her kullanıma uygulanır. ' +
      'Burada turboPiston, miras alınan piston[4] özelliğinin adlandırılmış bir alt kümesidir.',
    validateSuccess: 'TurboEngine, miras alınan piston\'u alt-kümeleyen turboPiston\'a sahip. Alt-kümeleme ustalaştı!',
    validateError: '`part def TurboEngine :> Engine { part turboPiston :> piston; }` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 6: Redefinition (5 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l6t1: {
    levelName: 'Yeniden Tanımlama',
    title: 'Miras Alınan Özelliği Yeniden Tanımla',
    instruction:
      '**Yeniden tanımlama** (`:>>`), miras alınan bir özelliği yeni bir adla ve/veya özelleştirilmiş tiple *değiştirir*.\n\n' +
      '`part def SmallVehicle :> Vehicle { }` oluşturun ve içine: `part smallEng :>> eng;` ekleyin.\n\n' +
      'Bu, miras alınan `eng`\'i `smallEng` ile değiştirir.',
    hint: '`part def SmallVehicle :> Vehicle { part smallEng :>> eng; }` ekleyin.',
    concept: 'Redefinition :>>',
    conceptExplanation:
      ':>> "redefines" anahtar sözcüğüyle eşdeğerdir. ' +
      '"part smallEng :>> eng", SmallVehicle\'ın miras alınan eng\'i smallEng ile değiştirdiği anlamına gelir. ' +
      'Yeniden tanımlama ad değiştirebilir, tipi özelleştirebilir ve çokluğu kısıtlayabilir.',
    validateSuccess: 'SmallVehicle, eng\'i smallEng olarak yeniden tanımlar. Aralarında bir yeniden tanımlama oku bulunur.',
    validateError: '`part def SmallVehicle :> Vehicle { part smallEng :>> eng; }` ekleyin.',
  },

  l6t2: {
    levelName: 'Yeniden Tanımlama',
    title: 'SportsCar\'da Tekerlekleri Yeniden Tanımla',
    instruction:
      'SportsCar normal tekerlekler yerine spor tekerleklere sahip olmalı.\n\n' +
      '`part def SportsCar :> Vehicle { }` içine: `part sportWheel :>> wheel;` ekleyin.',
    hint: '`part def SportsCar :> Vehicle { part sportWheel :>> wheel; }` ekleyin.',
    concept: 'Redefinition :>>',
    conceptExplanation:
      'sportWheel, miras alınan wheel[4]\'ü yeniden tanımlar (değiştirir). ' +
      'SportsCar\'da wheel özelliği artık sportWheel olarak adlandırılır.',
    validateSuccess: 'SportsCar, wheel\'i sportWheel olarak yeniden tanımlar.',
    validateError: '`part def SportsCar :> Vehicle { part sportWheel :>> wheel; }` ekleyin.',
  },

  l6t3: {
    levelName: 'Yeniden Tanımlama',
    title: 'Özelleştirmeyle Yeniden Tanımla',
    instruction:
      'Yeniden tanımlama tipi de özelleştirebilir. `part def SmallEngine :> Engine { }` oluşturun, ' +
      'sonra **SmallVehicle**\'da eng\'i tipli yeniden tanımlamayla güncelleyin.\n\n' +
      'SmallVehicle\'ın smallEng\'ini şuna değiştirin: `part smallEng :>> eng : SmallEngine;`',
    hint: 'Sözdizimi: `part smallEng :>> eng : SmallEngine;` — eng\'i yeniden tanımlar VE SmallEngine ile tipler.',
    concept: 'typed redefinition',
    conceptExplanation:
      'Tipli yeniden tanımlama özelliği değiştirir VE tipini özelleştirir. ' +
      '"part smallEng :>> eng : SmallEngine", smallEng\'in eng\'i değiştirdiği ve SmallEngine tipinde olduğu anlamına gelir.',
    validateSuccess: 'Tipli yeniden tanımlama: smallEng, eng\'i değiştiriyor VE SmallEngine ile tipleniyor.',
    validateError: '`part def SmallEngine :> Engine { }` ekleyin ve `part smallEng :>> eng : SmallEngine;` ile güncelleyin.',
  },

  l6t4: {
    levelName: 'Yeniden Tanımlama',
    title: 'Transmission\'ı Yeniden Tanımla',
    instruction:
      '`part def AutomaticTransmission :> Transmission { }` oluşturun, sonra trans\'ı yeniden tanımlayan ' +
      'bir `ElectricCar :> Vehicle` oluşturun.\n\n' +
      'ElectricCar içine: `part autoTrans :>> trans;` ekleyin.',
    hint: 'ElectricCar :> Vehicle ekleyin ve içine `part autoTrans :>> trans;` koyun.',
    concept: 'Redefinition :>>',
    conceptExplanation:
      'Her özelleştirilmiş araç tipi farklı miras alınan parçaları yeniden tanımlayabilir. ' +
      'Belirli bir araç varyantını bu şekilde yapılandırırsınız.',
    validateSuccess: 'ElectricCar, trans\'ı autoTrans olarak yeniden tanımlar. Yeniden tanımlama ustalaştı!',
    validateError: '`part def ElectricCar :> Vehicle { part autoTrans :>> trans; }` ekleyin.',
  },

  l6t5: {
    levelName: 'Yeniden Tanımlama',
    title: 'Çoklu Yeniden Tanımlama',
    instruction:
      'Özelleştirilmiş bir tanım birden çok miras alınan özelliği aynı anda yeniden tanımlayabilir.\n\n' +
      '**SportsCar** içine hem eng\'i hem wheel\'i yeniden tanımlayın:\n' +
      '- `part raceEng :>> eng;`\n' +
      '- `part raceWheel :>> wheel;`',
    hint: 'SportsCar { } içine her iki yeniden tanımlama satırını da ekleyin.',
    concept: 'multiple redefinitions',
    conceptExplanation:
      'Tek bir özelleştirilmiş tanım, miras alınan herhangi sayıda özelliği yeniden tanımlayabilir. ' +
      'Bir temel tipin özelleştirilmiş varyantını tam olarak bu şekilde yapılandırırsınız.',
    validateSuccess: 'SportsCar hem eng\'i hem wheel\'i yeniden tanımlıyor. Çoklu yeniden tanımlama tamamlandı!',
    validateError: 'SportsCar { } içine: `part raceEng :>> eng;` ve `part raceWheel :>> wheel;` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 7: Ports & Directed Features (8 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l7t1: {
    levelName: 'Portlar',
    title: 'Port Tanımı Oluştur',
    instruction:
      'Bir **port def**, sistem sınırında bir bağlantı sözleşmesi tanımlar.\n\n' +
      'Portlar, parçaların dış dünyayla nasıl etkileşeceğini belirler.\n\n' +
      'Modele `port def FuelPort { }` ekleyin.',
    hint: 'Yeni bir satıra `port def FuelPort { }` yazın.',
    concept: '«port def»',
    conceptExplanation:
      'Port tanımları, SysML v1\'deki interface bloklarının yerini alır. ' +
      'Bir bağlantı noktasının "şeklini" belirler. ' +
      'Her port def\'in örtük bir eşleniği (~FuelPort) vardır — in/out yönlerini tersine çevirir.',
    validateSuccess: 'FuelPort artık bir port tanımı. Sonraki adım: bunu Vehicle\'a yerleştirmek.',
    validateError: 'Modele `port def FuelPort { }` ekleyin.',
  },

  l7t2: {
    levelName: 'Portlar',
    title: 'Port Kullanımı Ekle',
    instruction:
      'Bir **port kullanımı**, bir bloğun sınırına bir bağlantı noktası yerleştirir.\n\n' +
      '**Vehicle** içine: `port fuelPort : FuelPort;` ekleyin.',
    hint: 'Vehicle { } içine: `port fuelPort : FuelPort;` ekleyin.',
    concept: 'port usage',
    conceptExplanation:
      'Bir port kullanımı mutlaka bir port tanımına atıfta bulunmalıdır. ' +
      'Diyagramda port, tanım bloğunun kenarında belirir.',
    validateSuccess: 'Vehicle artık bir fuelPort bağlantı noktasına sahip.',
  },

  l7t3: {
    levelName: 'Portlar',
    title: 'Elektrik Portu Oluştur',
    instruction:
      'Elektrik bağlantıları için başka bir port tanımı ekleyin.\n\n' +
      '`port def ElectricPort { }` ekleyin.',
    hint: 'Yeni bir satıra `port def ElectricPort { }` yazın.',
    concept: '«port def»',
    conceptExplanation:
      'Farklı port tanımları farklı bağlantı tiplerini temsil eder. ' +
      'FuelPort yakıtı, ElectricPort elektriği taşır. ' +
      'Bu tip güvenliği sağlar — uyumsuz portları bağlayamazsınız.',
    validateSuccess: 'ElectricPort tanımlandı. Farklı bağlantı sözleşmeleri için iki port tipi.',
    validateError: 'Modele `port def ElectricPort { }` ekleyin.',
  },

  l7t4: {
    levelName: 'Portlar',
    title: 'Yönlü Özellik Ekle (in)',
    instruction:
      'Port tanımları akış yönünü belirten **yönlü özelliklere** sahip olabilir.\n\n' +
      '**FuelPort** içine: `in attribute fuelIn : Real;` ekleyin.\n\n' +
      '`in` anahtar sözcüğü bu portun yakıt *aldığı* anlamına gelir.',
    hint: 'FuelPort { } içine `in attribute fuelIn : Real;` yazın.',
    concept: 'in / out / inout',
    conceptExplanation:
      '"in" port alır demek. "out" gönderir demek. "inout" iki yönlü demek. ' +
      'Yönlü özellikler bağlantılar için port uyumluluğunu belirler.',
    validateSuccess: 'FuelPort yakıtı fuelIn üzerinden alır. "in" yönü onu girdi olarak işaretler.',
    validateError: 'FuelPort { } içine: `in attribute fuelIn : Real;` ekleyin.',
  },

  l7t5: {
    levelName: 'Portlar',
    title: 'Çıktı Özelliği Ekle',
    instruction:
      'Şimdi FuelPort\'a bir çıktı özelliği ekleyin.\n\n' +
      '**FuelPort** içine: `out attribute exhaustOut : Real;` ekleyin.\n\n' +
      'Bu, yakıt portundan dışarı çıkan egzozu temsil eder.',
    hint: 'FuelPort { } içine `out attribute exhaustOut : Real;` ekleyin.',
    concept: 'out direction',
    conceptExplanation:
      'Hem "in" hem "out" özelliği bulunan bir port, iki yönlü bir sözleşme tanımlar. ' +
      'Yakıt girer, egzoz çıkar. Eşlenik port (~FuelPort) bu yönleri tersine çevirir.',
    validateSuccess: 'FuelPort artık hem in (fuelIn) hem de out (exhaustOut) yönlü özelliklere sahip.',
    validateError: 'FuelPort { } içine: `out attribute exhaustOut : Real;` ekleyin.',
  },

  l7t6: {
    levelName: 'Portlar',
    title: 'ElectricPort\'a Yönlü Özellik Ekle',
    instruction:
      'ElectricPort\'a yönlü özellikler ekleyin:\n\n' +
      '- `in attribute powerIn : Real;`\n' +
      '- `out attribute dataOut : Real;`',
    hint: 'ElectricPort { } içine her iki yönlü öznitelik satırını da ekleyin.',
    concept: 'in / out on ports',
    conceptExplanation:
      'Eşleşen yönlü özelliklere sahip portlar bağlantı için uyumludur. ' +
      'A portunda "out X" ve B portunda "in X" varsa bağlanabilirler.',
    validateSuccess: 'ElectricPort\'ta giriş gücü ve çıkış verisi tamam. Port sözleşmesi tam tanımlandı.',
    validateError: 'ElectricPort { } içine her iki yönlü özelliği de ekleyin.',
  },

  l7t7: {
    levelName: 'Portlar',
    title: 'Engine\'e Port Ekle',
    instruction:
      'Motorların da portu olmalı. Yakıt bağlantısı için **Engine**\'e bir port ekleyin.\n\n' +
      '**Engine** içine: `port engineFuel : FuelPort;` ekleyin.',
    hint: 'Engine { } içine: `port engineFuel : FuelPort;` ekleyin.',
    concept: 'port usage',
    conceptExplanation:
      'Birden fazla parça aynı port tanımını kullanabilir. Hem Vehicle hem Engine ' +
      'FuelPort\'a sahip — uyumlu portlar üzerinden bağlanabilirler.',
    validateSuccess: 'Engine artık bir FuelPort\'a sahip. Hem Vehicle hem Engine\'de uyumlu yakıt portu var.',
  },

  l7t8: {
    levelName: 'Portlar',
    title: 'Veri Portu Oluştur',
    instruction:
      'Sensör veri iletişimi için bir port tipi daha oluşturun.\n\n' +
      '`port def DataPort { }` ekleyin ve içine `inout attribute signal : Real;` koyun.\n\n' +
      '**`inout`** anahtar sözcüğü portun hem gönderdiği hem aldığı anlamına gelir.',
    hint: '`port def DataPort { inout attribute signal : Real; }` ekleyin.',
    concept: 'inout direction',
    conceptExplanation:
      '"inout" "in" ve "out"u birleştirir — port aynı özellik üzerinden hem gönderir hem alır. ' +
      'İki yönlü veri yolları ve kontrol sinyalleri için kullanışlıdır.',
    validateSuccess: 'DataPort\'ta inout signal. Portlar ve yönlü özellikler ustalaştı!',
    validateError: '`port def DataPort { inout attribute signal : Real; }` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 8: Items & Connections (6 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l8t1: {
    levelName: 'Öğeler ve Bağlantılar',
    title: 'Öğe Tanımı Oluştur',
    instruction:
      'Bir **item def**, uzayda ve zamanda var olan ama sistemin parçası olmak zorunda olmayan şeyleri tanımlar.\n\n' +
      'Öğeler bağlantılar üzerinden akanları modeller: veri, sinyal, enerji ya da malzeme.\n\n' +
      '`item def Fuel { }` ekleyin.',
    hint: 'Yeni bir satıra `item def Fuel { }` yazın.',
    concept: '«item def»',
    conceptExplanation:
      'Tüm parçalar öğe olarak ele alınabilir ama her öğe parça değildir. ' +
      'Yakıt sistemden akar ama aracın yapısal bir parçası değildir. ' +
      'Bir öğenin herhangi bir bölümü aynı türden bir şey ise o öğe süreklidir.',
    validateSuccess: 'Fuel artık bir öğe tanımı — yapısal parça değil, akan bir şey.',
    validateError: 'Modele `item def Fuel { }` ekleyin.',
  },

  l8t2: {
    levelName: 'Öğeler ve Bağlantılar',
    title: 'Daha Fazla Öğe Oluştur',
    instruction:
      'İki öğe tanımı daha oluşturun:\n\n' +
      '- `item def Electricity { }`\n' +
      '- `item def ExhaustGas { }`',
    hint: 'Yeni satırlara hem `item def Electricity { }` hem de `item def ExhaustGas { }` ekleyin.',
    concept: '«item def»',
    conceptExplanation:
      'Farklı öğeler farklı akış türlerini temsil eder. Yakıt, elektrik ve egzoz gazı ' +
      'aracın sisteminden akar ama temelde farklı şeylerdir.',
    validateSuccess: 'Üç öğe tipi tanımlandı: Fuel, Electricity ve ExhaustGas.',
    validateError: '`item def Electricity { }` ve `item def ExhaustGas { }` ekleyin.',
  },

  l8t3: {
    levelName: 'Öğeler ve Bağlantılar',
    title: 'Öğelere Öznitelik Ekle',
    instruction:
      'Öğelerin de tıpkı parçalar gibi öznitelikleri olabilir.\n\n' +
      '**Fuel** içine: `attribute octaneRating : Integer;` ekleyin.',
    hint: 'Fuel { } içine `attribute octaneRating : Integer;` yazın.',
    concept: 'item attributes',
    conceptExplanation:
      'Öğe öznitelikleri akan öğenin özelliklerini açıklar. ' +
      'Yakıtın oktan sayısı, elektriğin voltajı gibi.',
    validateSuccess: 'Fuel artık bir octaneRating özniteliğine sahip.',
  },

  l8t4: {
    levelName: 'Öğeler ve Bağlantılar',
    title: 'Bağlantı Tanımı Oluştur',
    instruction:
      'Bir **connection def**, parçalar arasındaki fiziksel veya mantıksal bağlantı tipini tanımlar.\n\n' +
      '`connection def FuelLine { }` ekleyin.',
    hint: 'Yeni bir satıra `connection def FuelLine { }` yazın.',
    concept: '«connection def»',
    conceptExplanation:
      'Bağlantı tanımları parçaların nasıl birbirine bağlandığını belirler. FuelLine yakıt portlarını bağlar. ' +
      'Bağlantılar, bağlı parçalar arasında öğeleri (Fuel gibi) taşır.',
    validateSuccess: 'FuelLine bir bağlantı tanımı — yakıt portları arasındaki bağlantıları tipler.',
    validateError: 'Modele `connection def FuelLine { }` ekleyin.',
  },

  l8t5: {
    levelName: 'Öğeler ve Bağlantılar',
    title: 'Arayüz Tanımı Oluştur',
    instruction:
      'Bir **interface def**, connection def\'e benzer ama sınır/sözleşmeyi vurgular.\n\n' +
      '`interface def PowerInterface { }` ekleyin.',
    hint: 'Yeni bir satıra `interface def PowerInterface { }` yazın.',
    concept: '«interface def»',
    conceptExplanation:
      'Arayüz tanımları sınırlarda nelerin açığa çıktığına odaklanır. ' +
      'Parçalar arasında akanlara odaklanan bağlantı tanımlarını tamamlarlar.',
    validateSuccess: 'PowerInterface tanımlandı — güç bağlantıları için bir arayüz sözleşmesi.',
    validateError: 'Modele `interface def PowerInterface { }` ekleyin.',
  },

  l8t6: {
    levelName: 'Öğeler ve Bağlantılar',
    title: 'Bağlantı İçinde Öğe Kullanımı',
    instruction:
      'Öğeler bağlantılar üzerinden akar. FuelLine içine bir öğe kullanımı ekleyin.\n\n' +
      '**FuelLine** içine: `item fuelFlow : Fuel;` ekleyin.',
    hint: 'FuelLine { } içine: `item fuelFlow : Fuel;` ekleyin.',
    concept: 'item flow',
    conceptExplanation:
      'Bir bağlantı içindeki öğe kullanımı, o bağlantı üzerinden akan şeyi temsil eder. ' +
      'FuelLine Fuel\'i taşır — bu akış modelini tamamlar.',
    validateSuccess: 'Yakıt FuelLine üzerinden akar. Öğeler ve bağlantılar ustalaştı!',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 9: Enumerations (5 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l9t1: {
    levelName: 'Sayım Türleri',
    title: 'Sayım Türü Oluştur',
    instruction:
      'Bir **enum def**, isimlendirilmiş sabit bir değer kümesi tanımlar.\n\n' +
      '`enum def FuelType { }` ekleyin.',
    hint: 'Yeni bir satıra `enum def FuelType { }` yazın.',
    concept: '«enum def»',
    conceptExplanation:
      'Sayım türleri, sonlu ve isimlendirilmiş olası değer kümesine sahip tiplerdir. ' +
      'Geçerli değerler kümesi bilindiğinde ve sabit olduğunda String yerine tercih edilir.',
    validateSuccess: 'FuelType artık bir sayım türü tanımı. Sonraki: değerlerini ekle.',
    validateError: 'Modele `enum def FuelType { }` ekleyin.',
  },

  l9t2: {
    levelName: 'Sayım Türleri',
    title: 'Sayım Değerleri Ekle',
    instruction:
      'FuelType içine üç değer ekleyin:\n\n' +
      '- `Gasoline;`\n' +
      '- `Diesel;`\n' +
      '- `Electric;`',
    hint: 'FuelType { } içine üç satır ekleyin: `Gasoline;`, `Diesel;`, `Electric;`',
    concept: 'enum values',
    conceptExplanation:
      'Bir enum içindeki her değer o tipin bir üyesidir. ' +
      'FuelType tipinde bir öznitelik yalnızca bu üç değerden birine sahip olabilir.',
    validateSuccess: 'FuelType\'ın üç değeri var: Gasoline, Diesel, Electric.',
    validateError: 'FuelType { } içine: `Gasoline;` `Diesel;` `Electric;` ekleyin.',
  },

  l9t3: {
    levelName: 'Sayım Türleri',
    title: 'Sayım Türünü Öznitelik Tipi Olarak Kullan',
    instruction:
      'Şimdi FuelType\'ı bir öznitelik tipi olarak kullanın.\n\n' +
      '**Engine** içine: `attribute fuelType : FuelType;` ekleyin.',
    hint: 'Engine { } içine: `attribute fuelType : FuelType;` ekleyin.',
    concept: 'enum as type',
    conceptExplanation:
      'Sayım türleri diğer tipler gibi kullanılır. "attribute fuelType : FuelType" ' +
      'motorun yakıt tipinin Gasoline, Diesel veya Electric\'ten biri olması gerektiği anlamına gelir.',
    validateSuccess: 'Engine artık FuelType sayım türüyle tiplenmiş bir fuelType özniteliğine sahip.',
  },

  l9t4: {
    levelName: 'Sayım Türleri',
    title: 'Başka Bir Sayım Türü Oluştur',
    instruction:
      'Şanzıman modları için bir sayım türü oluşturun.\n\n' +
      '`enum def TransmissionMode { }` ekleyin ve değerleri `Manual;`, `Automatic;`, `CVT;` olsun.',
    hint: '`enum def TransmissionMode { Manual; Automatic; CVT; }` ekleyin.',
    concept: '«enum def»',
    conceptExplanation:
      'Sabit seçenek kümesine sahip her alan kavramı bir sayım türü olmalıdır. ' +
      'TransmissionMode olası değerleri Manual, Automatic veya CVT ile sınırlar.',
    validateSuccess: 'Manual, Automatic, CVT değerleriyle TransmissionMode sayım türü oluşturuldu.',
    validateError: '`enum def TransmissionMode { Manual; Automatic; CVT; }` ekleyin.',
  },

  l9t5: {
    levelName: 'Sayım Türleri',
    title: 'Renk Sayım Türü Oluştur',
    instruction:
      '`enum def Color { }` oluşturun, değerleri `Red;`, `Blue;`, `Black;`, `White;`, `Silver;` olsun.\n\n' +
      'Sonra **Vehicle** içine `attribute color : Color;` ekleyin.',
    hint: 'Beş değerli Color sayım türünü ekleyin, ardından Vehicle içine `attribute color : Color;` ekleyin.',
    concept: 'enum usage',
    conceptExplanation:
      'Sayım türleri modelleri kesin yapar. "attribute color : String" (herhangi bir metin) yerine ' +
      '"attribute color : Color" değeri tam olarak tanımlı kümeyle sınırlar.',
    validateSuccess: 'Vehicle, sabit bir sayım türünden Color özniteliğine sahip. Sayım türleri ustalaştı!',
    validateError: '`enum def Color { Red; Blue; Black; White; Silver; }` ve Vehicle içine `attribute color : Color;` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 10: Actions & Flows (10 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l10t1: {
    levelName: 'Eylemler',
    title: 'Eylem Tanımı Oluştur',
    instruction:
      'Bir **action def**, bir davranışı tanımlar — sistemin yaptığı bir şey.\n\n' +
      'Eylemler, yapısal parça tanımlarının davranışsal karşılığıdır.\n\n' +
      '`action def StartEngine { }` ekleyin.',
    hint: 'Yeni bir satıra `action def StartEngine { }` yazın.',
    concept: '«action def»',
    conceptExplanation:
      'Eylem tanımları davranışları, süreçleri ve dönüşümleri modeller. ' +
      'Parametreleri (in/out), iç içe eylemleri ve succession aracılığıyla zamansal sıralama olabilir.',
    validateSuccess: 'StartEngine artık bir eylem tanımı — davranışsal bir şablon.',
    validateError: 'Yeni bir satıra `action def StartEngine { }` ekleyin.',
  },

  l10t2: {
    levelName: 'Eylemler',
    title: 'Daha Fazla Eylem Oluştur',
    instruction:
      'Bir sürüş dizisi için üç eylem tanımı daha oluşturun:\n\n' +
      '- `action def Accelerate { }`\n' +
      '- `action def Cruise { }`\n' +
      '- `action def Brake { }`',
    hint: 'Üç eylem tanımının tamamını yeni satırlara ekleyin.',
    concept: '«action def»',
    conceptExplanation:
      'Her ayrı davranış kendi eylem tanımına sahip olur. ' +
      'Daha sonra bunları zamansal sıralamayla birleştirip dizilere dönüştüreceksiniz.',
    validateSuccess: 'Sıralama için dört eylem tanımı hazır.',
    validateError: '`action def Accelerate { }`, `action def Cruise { }` ve `action def Brake { }` ekleyin.',
  },

  l10t3: {
    levelName: 'Eylemler',
    title: 'Eyleme Parametre Ekle',
    instruction:
      'Eylemlerin **girdi** ve **çıktı** parametreleri olabilir.\n\n' +
      '**StartEngine** içine ekleyin:\n' +
      '- `in item ignitionKey : Boolean;`\n' +
      '- `out item engineRunning : Boolean;`',
    hint: 'StartEngine { } içine hem in hem out parametre satırlarını ekleyin.',
    concept: 'action parameters',
    conceptExplanation:
      'Eylem parametreleri girdiyle çıktıyı tanımlar. ' +
      '"in" parametreleri eylem tarafından tüketilen girdilerdir. "out" parametreleri ise üretilen çıktılardır.',
    validateSuccess: 'StartEngine\'in girdisi (ignitionKey) ve çıktısı (engineRunning) var.',
    validateError: 'StartEngine { } içine: `in item ignitionKey : Boolean;` ve `out item engineRunning : Boolean;` ekleyin.',
  },

  l10t4: {
    levelName: 'Eylemler',
    title: 'Bileşik Eylem Oluştur',
    instruction:
      'Eylem kullanımları içeren bileşik bir **DriveCycle** eylemi oluşturun.\n\n' +
      '`action def DriveCycle { }` ekleyin ve içine şu eylem kullanımlarını koyun:\n' +
      '- `action start : StartEngine;`\n' +
      '- `action accel : Accelerate;`',
    hint: '`action def DriveCycle { action start : StartEngine; action accel : Accelerate; }` ekleyin.',
    concept: 'composite action',
    conceptExplanation:
      'Tıpkı part def\'ler içindeki part kullanımları gibi, action def\'ler içindeki action kullanımları davranışsal hiyerarşi oluşturur. ' +
      'DriveCycle, start ve accel\'i alt eylem olarak içerir.',
    validateSuccess: 'DriveCycle artık start ve accel alt eylemlerini içeriyor.',
    validateError: '`action def DriveCycle { }` içine action kullanımları ekleyin.',
  },

  l10t5: {
    levelName: 'Eylemler',
    title: 'Daha Fazla Alt Eylem Ekle',
    instruction:
      'DriveCycle\'ı oluşturmaya devam edin. İçine ekleyin:\n\n' +
      '- `action cruise : Cruise;`\n' +
      '- `action brake : Brake;`',
    hint: 'DriveCycle { } içine her iki action kullanım satırını da ekleyin.',
    concept: 'composite action',
    conceptExplanation:
      'Tam bir sürüş döngüsünün dört adımı vardır: start → accelerate → cruise → brake. ' +
      'Sonraki adımda bunları succession ile sıralayacaksınız.',
    validateSuccess: 'DriveCycle\'da dört alt eylem de var. Sonraki: succession ile sırala.',
    validateError: 'DriveCycle { } içine: `action cruise : Cruise;` ve `action brake : Brake;` ekleyin.',
  },

  l10t6: {
    levelName: 'Eylemler',
    title: 'Succession Ekle',
    instruction:
      '**Succession**\'lar `first ... then ...` ile çalışma sırasını belirler.\n\n' +
      '**DriveCycle** içine ekleyin:\n' +
      '`first start then accel;`',
    hint: 'DriveCycle { } içinde action kullanımlarından sonra: `first start then accel;` ekleyin.',
    concept: 'succession (then)',
    conceptExplanation:
      '"first start then accel", start bitmeden accel başlayamaz anlamına gelir. ' +
      'Succession\'lar action kullanımları arasındaki yönlü zamansal ilişkilerdir.',
    validateSuccess: 'start → accel succession\'ı tanımlandı! Eylemler artık zamansal sıraya sahip.',
    validateError: 'DriveCycle { } içine: `first start then accel;` ekleyin.',
  },

  l10t7: {
    levelName: 'Eylemler',
    title: 'Succession Zinciri',
    instruction:
      'Geri kalan succession zincirini ekleyin.\n\n' +
      '**DriveCycle** içine ekleyin:\n' +
      '- `first accel then cruise;`\n' +
      '- `first cruise then brake;`',
    hint: 'DriveCycle içine her iki succession satırını da ekleyin.',
    concept: 'succession chain',
    conceptExplanation:
      'Zincirleme succession\'lar tam bir diziyi tanımlar: start → accel → cruise → brake. ' +
      'Bu, sürüş döngüsü davranışının akış modelidir.',
    validateSuccess: 'Tam dizi: start → accel → cruise → brake.',
    validateError: 'DriveCycle içine: `first accel then cruise;` ve `first cruise then brake;` ekleyin.',
  },

  l10t8: {
    levelName: 'Eylemler',
    title: 'Fork Düğümü Ekle',
    instruction:
      'Bir **fork** akışı eşzamanlı dallara böler — paralel çalıştırma.\n\n' +
      '`action def Launch { }` oluşturun, içinde:\n' +
      '- `action ignite : Ignite;`\n' +
      '- `action release : Release;`\n' +
      '- `fork forkNode;`\n\n' +
      'Ayrıca `action def Ignite { }` ve `action def Release { }` oluşturun.',
    hint: 'Action def\'leri oluşturun, sonra Launch içine kullanımları ve `fork forkNode;` ekleyin.',
    concept: 'fork',
    conceptExplanation:
      'Fork düğümleri tek bir akışı birden fazla eşzamanlı akışa böler. ' +
      'Fork\'tan sonra giden tüm dallar paralel çalıştırılır.',
    validateSuccess: 'Fork düğümü oluşturuldu! Ignite ve Release eşzamanlı çalıştırılabilir.',
    validateError: 'Ignite, Release ve Launch action def\'lerini oluşturun, Launch içine `fork forkNode;` ekleyin.',
  },

  l10t9: {
    levelName: 'Eylemler',
    title: 'Join Düğümü Ekle',
    instruction:
      'Bir **join**, eşzamanlı dalları tekrar birleştirir.\n\n' +
      '**Launch** içine: `join joinNode;` ekleyin.\n\n' +
      'Join, devam etmeden önce tüm gelen dalların tamamlanmasını bekler.',
    hint: 'Launch { } içine: `join joinNode;` ekleyin.',
    concept: 'join',
    conceptExplanation:
      'Join, fork\'un karşılığıdır. Fork paralel yollara böler, ' +
      'join onları tekrar birleştirir. Tüm dallar tamamlanmadan join\'den sonraki hiçbir eylem başlamaz.',
    validateSuccess: 'Join düğümü eklendi. Fork böler, join birleştirir — paralel desen tamamlandı.',
    validateError: 'Launch { } içine: `join joinNode;` ekleyin.',
  },

  l10t10: {
    levelName: 'Eylemler',
    title: 'Decide ve Merge Ekle',
    instruction:
      'Bir **decide**, koşula göre bir dal seçer. Bir **merge**, alternatifleri birleştirir.\n\n' +
      '`action def MissionControl { }` oluşturun, içinde:\n' +
      '- `action launch : Launch;`\n' +
      '- `action abort : Abort;`\n' +
      '- `decide decideNode;`\n' +
      '- `merge mergeNode;`\n\n' +
      'Ayrıca `action def Abort { }` oluşturun.',
    hint: 'Abort def\'i oluşturun, sonra MissionControl\'ı action kullanımları, decide ve merge ile kurun.',
    concept: 'decide / merge',
    conceptExplanation:
      'Decide tam olarak bir dal seçer (özel seçim). ' +
      'Merge alternatif dalları birleştirir. Bu koşullu davranışı modeller.',
    validateSuccess: 'Decide/merge deseni tamamlandı. Eylemler tamamen kapsandı!',
    validateError: 'Abort ve MissionControl oluşturun, decide/merge düğümleri ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 11: States & Transitions (8 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l11t1: {
    levelName: 'Durumlar',
    title: 'Durum Tanımı Oluştur',
    instruction:
      'Bir **state def**, sistemin yaşam döngüsü durumlarını tanımlar.\n\n' +
      'Durum tanımları, durum kullanımlarını ve aralarındaki geçişleri içerir.\n\n' +
      '`state def VehicleStates { }` ekleyin.',
    hint: 'Yeni bir satıra `state def VehicleStates { }` yazın.',
    concept: '«state def»',
    conceptExplanation:
      'Durum tanımları sistemin yaşam döngüsünü bir durum ve geçiş kümesi olarak modeller. ' +
      'Bir durum makinesi sistemin zaman içinde durumlar arasında nasıl hareket ettiğini gösterir.',
    validateSuccess: 'VehicleStates artık bir durum tanımı — bir durum makinesi şablonu.',
    validateError: 'Yeni bir satıra `state def VehicleStates { }` ekleyin.',
  },

  l11t2: {
    levelName: 'Durumlar',
    title: 'Durumlar Ekle',
    instruction:
      '**VehicleStates** içine üç durum kullanımı ekleyin:\n\n' +
      '- `state off;`\n' +
      '- `state idle;`\n' +
      '- `state running;`',
    hint: 'VehicleStates { } içine üç durum satırını ekleyin.',
    concept: 'state usage',
    conceptExplanation:
      'Durum kullanımları sistemin içinde bulunabileceği olası durumları tanımlar. ' +
      'Araç off, idle veya running durumunda olabilir — bunlar karşılıklı dışlayan durumlardır.',
    validateSuccess: 'Üç durum tanımlandı: off, idle, running.',
    validateError: 'VehicleStates { } içine: `state off;`, `state idle;`, `state running;` ekleyin.',
  },

  l11t3: {
    levelName: 'Durumlar',
    title: 'Daha Fazla Durum Ekle',
    instruction:
      'Araç yaşam döngüsünü tamamlamak için iki durum daha ekleyin:\n\n' +
      '- `state moving;`\n' +
      '- `state stopped;`',
    hint: 'VehicleStates { } içine her iki durum satırını da ekleyin.',
    concept: 'state usage',
    conceptExplanation:
      'Tam bir durum makinesi tüm olası yaşam döngüsü durumlarını kapsar. ' +
      'Beş durum: off → idle → running → moving → stopped.',
    validateSuccess: 'Araç yaşam döngüsünde beş durum. Sonraki: geçişler ekle.',
    validateError: 'VehicleStates içine: `state moving;` ve `state stopped;` ekleyin.',
  },

  l11t4: {
    levelName: 'Durumlar',
    title: 'İlk Geçişi Ekle',
    instruction:
      'Bir **transition** durum değişimini tanımlar.\n\n' +
      '**VehicleStates** içine ekleyin:\n' +
      '`transition first off then idle;`\n\n' +
      'Bu, aracın off\'tan idle\'a geçtiği anlamına gelir.',
    hint: 'VehicleStates { } içine: `transition first off then idle;` ekleyin.',
    concept: 'transition',
    conceptExplanation:
      '"transition first S1 then S2", yönlü bir durum değişimi tanımlar. ' +
      'Geçiş tetiklendiğinde sistem S1 durumundan S2 durumuna geçer.',
    validateSuccess: 'Geçiş: off → idle. Araç açılıyor ve idle durumuna giriyor.',
    validateError: 'VehicleStates içine: `transition first off then idle;` ekleyin.',
  },

  l11t5: {
    levelName: 'Durumlar',
    title: 'Daha Fazla Geçiş Ekle',
    instruction:
      'İki geçiş daha ekleyin:\n\n' +
      '- `transition first idle then running;`\n' +
      '- `transition first running then moving;`',
    hint: 'VehicleStates içine her iki geçiş satırını da ekleyin.',
    concept: 'transition chain',
    conceptExplanation:
      'Geçişler durumlar arasında yönlü bir grafik oluşturur. ' +
      'off → idle → running → moving araç çalıştırma dizisini gösterir.',
    validateSuccess: 'Geçiş zinciri: off → idle → running → moving.',
    validateError: 'VehicleStates içine her iki geçişi de ekleyin.',
  },

  l11t6: {
    levelName: 'Durumlar',
    title: 'Geri Dönüş Geçişleri Ekle',
    instruction:
      'Durumlar önceki durumlara geri dönebilir. Ekleyin:\n\n' +
      '- `transition first moving then stopped;`\n' +
      '- `transition first stopped then off;`',
    hint: 'Her iki geri dönüş geçişini de ekleyin.',
    concept: 'bidirectional transitions',
    conceptExplanation:
      'Geçişler döngü oluşturabilir. moving → stopped → off yaşam döngüsünü tamamlar. ' +
      'Tam grafik: off → idle → running → moving → stopped → off.',
    validateSuccess: 'Tam yaşam döngüsü: off → idle → running → moving → stopped → off.',
    validateError: '`transition first moving then stopped;` ve `transition first stopped then off;` ekleyin.',
  },

  l11t7: {
    levelName: 'Durumlar',
    title: 'Ayrı Bir Durum Makinesi Oluştur',
    instruction:
      'Bir trafik ışığı için yeni bir durum makinesi oluşturun.\n\n' +
      '`state def TrafficLightStates { }` içine:\n' +
      '- `state red;`\n' +
      '- `state yellow;`\n' +
      '- `state green;`',
    hint: 'state def\'i üç durum kullanımıyla ekleyin.',
    concept: '«state def»',
    conceptExplanation:
      'Her sistem veya alt sistem kendi durum makinesine sahip olabilir. ' +
      'Trafik ışıkları basit döngüsel bir durum modeline sahiptir: red → green → yellow → red.',
    validateSuccess: 'TrafficLightStates red, yellow, green durumlarıyla tanımlandı.',
    validateError: '`state def TrafficLightStates { }` içine red, yellow, green ekleyin.',
  },

  l11t8: {
    levelName: 'Durumlar',
    title: 'Trafik Işığı Döngüsünü Tamamla',
    instruction:
      'Trafik ışığı için döngüsel geçişler ekleyin:\n\n' +
      '- `transition first red then green;`\n' +
      '- `transition first green then yellow;`\n' +
      '- `transition first yellow then red;`',
    hint: 'TrafficLightStates içine üç geçişi de ekleyin.',
    concept: 'cyclic transitions',
    conceptExplanation:
      'Döngüsel durum makineleri sonsuza kadar tekrarlar: red → green → yellow → red → ... ' +
      'Bu standart trafik ışığı desenidir. Durumlar ustalaştı!',
    validateSuccess: 'Trafik ışığı döngüsü tamamlandı: red → green → yellow → red. Durumlar ustalaştı!',
    validateError: 'TrafficLightStates içine üç döngüsel geçişi de ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 12: Requirements (8 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l12t1: {
    levelName: 'Gereksinimler',
    title: 'Gereksinim Tanımı Oluştur',
    instruction:
      'Bir **requirement def**, sistemin sağlaması gereken bir koşulu yakalar.\n\n' +
      '`requirement def MassRequirement { }` ekleyin.',
    hint: 'Yeni bir satıra `requirement def MassRequirement { }` yazın.',
    concept: '«requirement def»',
    conceptExplanation:
      'Gereksinimler sistemin ne yapması veya ne olması gerektiğini biçimselleştirir. ' +
      'Belgeleme metni, bir özne ve tasarım öğeleriyle ilişkiler içerebilir.',
    validateSuccess: 'MassRequirement tanımlandı — biçimsel bir gereksinim tipi.',
    validateError: 'Modele `requirement def MassRequirement { }` ekleyin.',
  },

  l12t2: {
    levelName: 'Gereksinimler',
    title: 'Gereksinime Belgeleme Ekle',
    instruction:
      'Gereksinimler belgeleme metnine sahip olmalıdır.\n\n' +
      '**MassRequirement** içine ekleyin:\n' +
      '`doc /* The vehicle mass shall not exceed 2000 kg. */`',
    hint: 'MassRequirement { } içine doc satırını ekleyin.',
    concept: 'doc comment',
    conceptExplanation:
      '"doc /* metin */" bir model öğesine biçimsel belgeleme ekler. ' +
      'Bu, gereksinim metnidir — karşılanması gereken koşul.',
    validateSuccess: 'MassRequirement artık biçimsel belgeleme metnine sahip.',
    validateError: 'MassRequirement { } içine: `doc /* The vehicle mass shall not exceed 2000 kg. */` ekleyin.',
  },

  l12t3: {
    levelName: 'Gereksinimler',
    title: 'Daha Fazla Gereksinim Oluştur',
    instruction:
      'İki gereksinim tanımı daha ekleyin:\n\n' +
      '- `requirement def SpeedRequirement { }`\n' +
      '- `requirement def SafetyRequirement { }`',
    hint: 'Her iki gereksinim tanımını da yeni satırlara ekleyin.',
    concept: '«requirement def»',
    conceptExplanation:
      'Bir sistemde tipik olarak performans, güvenlik, maliyet, güvenilirlik gibi ' +
      'kalite özniteliklerini kapsayan birçok gereksinim olur.',
    validateSuccess: 'Üç gereksinim: kütle, hız ve güvenlik.',
    validateError: '`requirement def SpeedRequirement { }` ve `requirement def SafetyRequirement { }` ekleyin.',
  },

  l12t4: {
    levelName: 'Gereksinimler',
    title: 'Hız Gereksinimine Belgeleme Ekle',
    instruction:
      'SpeedRequirement\'a belgeleme ekleyin:\n\n' +
      '`doc /* The vehicle shall achieve a top speed of at least 200 km/h. */`',
    hint: 'SpeedRequirement { } içine doc satırını ekleyin.',
    concept: 'requirement text',
    conceptExplanation:
      'Her gereksinimin net ve test edilebilir belgelemesi olmalıdır. ' +
      '"shall" sözcüğü gereksinim metinlerinde standart kullanım (IEEE 830 geleneği).',
    validateSuccess: 'SpeedRequirement biçimsel metnine kavuştu. Net ve test edilebilir bir gereksinim.',
    validateError: 'SpeedRequirement { } içine hızla ilgili bir doc yorumu ekleyin.',
  },

  l12t5: {
    levelName: 'Gereksinimler',
    title: 'Gereksinimi Karşıla (Satisfy)',
    instruction:
      '**satisfy** ilişkisi bir tasarım öğesinin bir gereksinimi karşıladığını ifade eder.\n\n' +
      'Ekleyin: `satisfy MassRequirement by Vehicle;`',
    hint: 'Yeni bir satıra `satisfy MassRequirement by Vehicle;` yazın.',
    concept: 'satisfy',
    conceptExplanation:
      '"satisfy R by X", X tasarım öğesinin R gereksinimini karşıladığını ifade eder. ' +
      'Bu, gereksinimler ile tasarım arasında izlenebilirlik oluşturur.',
    validateSuccess: 'Vehicle, MassRequirement\'ı karşılıyor. İzlenebilirlik kuruldu!',
    validateError: 'Yeni bir satıra `satisfy MassRequirement by Vehicle;` ekleyin.',
  },

  l12t6: {
    levelName: 'Gereksinimler',
    title: 'Başka Bir Gereksinimi Karşıla',
    instruction:
      'Başka bir satisfy ilişkisi ekleyin:\n\n' +
      '`satisfy SpeedRequirement by Vehicle;`',
    hint: 'Yeni bir satıra `satisfy SpeedRequirement by Vehicle;` yazın.',
    concept: 'satisfy',
    conceptExplanation:
      'Tek bir tasarım öğesi birden fazla gereksinimi karşılayabilir. ' +
      'Vehicle hem kütle hem de hız gereksinimlerini karşılar.',
    validateSuccess: 'Vehicle, hem MassRequirement\'ı hem de SpeedRequirement\'ı karşılıyor.',
    validateError: 'Yeni bir satıra `satisfy SpeedRequirement by Vehicle;` ekleyin.',
  },

  l12t7: {
    levelName: 'Gereksinimler',
    title: 'Gereksinimi Doğrula (Verify)',
    instruction:
      '**verify** ilişkisi bir test durumunun bir gereksinimi doğruladığını ifade eder.\n\n' +
      'Önce `part def MassTest { }` ekleyin, sonra:\n' +
      '`verify MassRequirement by MassTest;` ekleyin.',
    hint: '`part def MassTest { }` ve `verify MassRequirement by MassTest;` ekleyin.',
    concept: 'verify',
    conceptExplanation:
      '"verify R by T", T testinin R gereksinimini doğruladığını ifade eder. ' +
      'Satisfy tasarımı gereksinime, verify ise testi gereksinime bağlar.',
    validateSuccess: 'MassTest, MassRequirement\'ı doğrular. Tam izlenebilirlik: tasarım ← gereksinim → test.',
    validateError: '`part def MassTest { }` ve `verify MassRequirement by MassTest;` ekleyin.',
  },

  l12t8: {
    levelName: 'Gereksinimler',
    title: 'Gereksinim Hiyerarşisi Oluştur',
    instruction:
      'Gereksinimler diğer gereksinimleri özelleştirebilir.\n\n' +
      '`requirement def BrakingDistance :> SafetyRequirement { }` ekleyin, içine:\n' +
      '`doc /* Braking distance shall be less than 40m from 100 km/h. */`',
    hint: 'Özelleştirilmiş gereksinimi doc metniyle birlikte ekleyin.',
    concept: 'requirement specialization',
    conceptExplanation:
      'Gereksinim özelleştirme bir hiyerarşi oluşturur. BrakingDistance :> SafetyRequirement, ' +
      'BrakingDistance\'in özel bir güvenlik gereksinimi olduğu anlamına gelir. Gereksinimler ustalaştı!',
    validateSuccess: 'BrakingDistance, SafetyRequirement\'ı özelleştirir. Gereksinim hiyerarşisi kuruldu!',
    validateError: '`requirement def BrakingDistance :> SafetyRequirement { }` doc metniyle birlikte ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 13: Constraints & Calculations (7 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l13t1: {
    levelName: 'Kısıtlar ve Hesaplamalar',
    title: 'Kısıt Tanımı Oluştur',
    instruction:
      'Bir **constraint def**, doğru olması gereken bir mantıksal koşulu tanımlar.\n\n' +
      '`constraint def MassLimit { }` ekleyin.',
    hint: 'Yeni bir satıra `constraint def MassLimit { }` yazın.',
    concept: '«constraint def»',
    conceptExplanation:
      'Kısıtlar yüklemlerdir — sistemi kısıtlayan mantıksal ifadeler. ' +
      '"Toplam kütle 2000 kg\'ı geçmemeli" gibi kuralları biçimselleştirir.',
    validateSuccess: 'MassLimit bir kısıt tanımı — bir mantıksal yüklem.',
    validateError: 'Modele `constraint def MassLimit { }` ekleyin.',
  },

  l13t2: {
    levelName: 'Kısıtlar ve Hesaplamalar',
    title: 'Kısıt Parametreleri Ekle',
    instruction:
      'Kısıtların değerlendirdiği parametreleri vardır.\n\n' +
      '**MassLimit** içine ekleyin:\n' +
      '`in attribute mass : Real;`',
    hint: 'MassLimit { } içine: `in attribute mass : Real;` ekleyin.',
    concept: 'constraint parameters',
    conceptExplanation:
      'Kısıt parametreleri kontrol edilen değerlerdir. ' +
      '"in attribute mass : Real", MassLimit\'in bir kütle değeri alıp denetlediği anlamına gelir.',
    validateSuccess: 'MassLimit, değerlendireceği bir mass girdi parametresine sahip.',
    validateError: 'MassLimit { } içine: `in attribute mass : Real;` ekleyin.',
  },

  l13t3: {
    levelName: 'Kısıtlar ve Hesaplamalar',
    title: 'Hesaplama Tanımı Oluştur',
    instruction:
      'Bir **calc def**, tipli parametrelere sahip bir hesaplamayı tanımlar.\n\n' +
      '`calc def TotalMass { }` ekleyin.',
    hint: 'Yeni bir satıra `calc def TotalMass { }` yazın.',
    concept: '«calc def»',
    conceptExplanation:
      'Hesaplamalar girdilerden değer üretir. Kısıtların (mantıksal yüklemler) aksine ' +
      'hesaplamalar tipli bir sonuç üretir — hesaplanmış bir değer.',
    validateSuccess: 'TotalMass bir hesaplama tanımı — bir değer hesaplar.',
    validateError: 'Modele `calc def TotalMass { }` ekleyin.',
  },

  l13t4: {
    levelName: 'Kısıtlar ve Hesaplamalar',
    title: 'Hesaplama Parametreleri Ekle',
    instruction:
      'TotalMass\'a girdi ve çıktı parametreleri ekleyin:\n\n' +
      '- `in attribute bodyMass : Real;`\n' +
      '- `in attribute cargoMass : Real;`\n' +
      '- `out attribute result : Real;`',
    hint: 'TotalMass { } içine üç parametre satırını da ekleyin.',
    concept: 'calc parameters',
    conceptExplanation:
      'Hesaplamalar girdi alır ve çıktı üretir. ' +
      'TotalMass, bodyMass ve cargoMass\'ı girdi olarak alır ve bir result üretir.',
    validateSuccess: 'TotalMass, bodyMass + cargoMass alır ve bir sonuç üretir.',
    validateError: 'TotalMass içine iki "in" parametresi ve bir "out" parametresi ekleyin.',
  },

  l13t5: {
    levelName: 'Kısıtlar ve Hesaplamalar',
    title: 'Başka Bir Kısıt Oluştur',
    instruction:
      'Bir hız kısıtı oluşturun:\n\n' +
      '`constraint def SpeedLimit { }` içine `in attribute speed : Real;` ekleyin.',
    hint: 'Kısıt tanımını in parametresiyle birlikte ekleyin.',
    concept: '«constraint def»',
    conceptExplanation:
      'Birden çok kısıt sistemin farklı yönlerini yönetebilir. ' +
      'MassLimit kütleyi, SpeedLimit ise hızı kısıtlar.',
    validateSuccess: 'SpeedLimit kısıtı bir speed parametresiyle tanımlandı.',
    validateError: '`constraint def SpeedLimit { in attribute speed : Real; }` ekleyin.',
  },

  l13t6: {
    levelName: 'Kısıtlar ve Hesaplamalar',
    title: 'Güvenlik Faktörü Hesabı Oluştur',
    instruction:
      'Güvenlik faktörü için bir hesaplama oluşturun:\n\n' +
      '`calc def SafetyFactor { }` içine:\n' +
      '- `in attribute loadCapacity : Real;`\n' +
      '- `in attribute actualLoad : Real;`\n' +
      '- `out attribute factor : Real;`',
    hint: 'Calc def\'i üç parametreyle birlikte ekleyin.',
    concept: '«calc def»',
    conceptExplanation:
      'SafetyFactor, loadCapacity / actualLoad\'u hesaplar. ' +
      'Hesaplamalar sistemdeki matematiksel ilişkileri modeller.',
    validateSuccess: 'SafetyFactor hesabı doğru in/out parametreleriyle tanımlandı.',
    validateError: '`calc def SafetyFactor { }` in/out parametreleriyle birlikte ekleyin.',
  },

  l13t7: {
    levelName: 'Kısıtlar ve Hesaplamalar',
    title: 'Kısıtı Özelleştir',
    instruction:
      'Kısıtlar diğer kısıtları özelleştirebilir.\n\n' +
      '`constraint def EmergencyMassLimit :> MassLimit { }` ekleyin.',
    hint: 'Yeni bir satıra `constraint def EmergencyMassLimit :> MassLimit { }` yazın.',
    concept: 'constraint specialization',
    conceptExplanation:
      'EmergencyMassLimit :> MassLimit daha sıkı bir kütle kısıtıdır. ' +
      'Özelleştirme tüm tanım türlerinde çalışır — part, constraint, calc vb.',
    validateSuccess: 'EmergencyMassLimit, MassLimit\'i özelleştirir. Kısıtlar ve hesaplamalar ustalaştı!',
    validateError: 'Yeni bir satıra `constraint def EmergencyMassLimit :> MassLimit { }` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 14: Packages & Imports (6 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l14t1: {
    levelName: 'Paketler ve İçe Aktarma',
    title: 'Paket Oluştur',
    instruction:
      'Bir **package**, ilgili tanımları gruplandıran bir ad alanıdır.\n\n' +
      '`package VehicleDomain { }` ekleyin ve içine bir `part def Vehicle { }` koyun.',
    hint: '`package VehicleDomain { part def Vehicle { } }` yazın.',
    concept: 'package',
    conceptExplanation:
      'Paketler modelleri ad alanlarına ayırarak organize eder. Bir paket içindeki öğeler ' +
      'o paketin kapsamına girer. İçe aktarma diğer paketlerdeki öğeleri görünür kılar.',
    validateSuccess: 'VehicleDomain paketi içinde Vehicle ile oluşturuldu. Öğeler artık ad alanlı.',
    validateError: '`package VehicleDomain { part def Vehicle { } }` ekleyin.',
  },

  l14t2: {
    levelName: 'Paketler ve İçe Aktarma',
    title: 'Pakete Daha Fazla Tanım Ekle',
    instruction:
      '**VehicleDomain** içine `part def Engine { }` ve `part def Wheel { }` ekleyin.',
    hint: 'package VehicleDomain { } içine her iki parça tanımını da ekleyin.',
    concept: 'package contents',
    conceptExplanation:
      'Bir paket istediğiniz sayıda tanım içerebilir. ' +
      'VehicleDomain içindeki tüm öğelerin ad alanı VehicleDomain::\'dür.',
    validateSuccess: 'VehicleDomain artık Vehicle, Engine ve Wheel içeriyor.',
    validateError: 'VehicleDomain içine `part def Engine { }` ve `part def Wheel { }` ekleyin.',
  },

  l14t3: {
    levelName: 'Paketler ve İçe Aktarma',
    title: 'İkinci Bir Paket Oluştur',
    instruction:
      'Gereksinimler için başka bir paket oluşturun:\n\n' +
      '`package Requirements { }` içine `requirement def MassReq { }` ekleyin.',
    hint: '`package Requirements { requirement def MassReq { } }` ekleyin.',
    concept: 'multiple packages',
    conceptExplanation:
      'Farklı konular için ayrı paketler: yapı için VehicleDomain, gereksinimler için Requirements. ' +
      'Bu, iyi bir model organizasyon uygulamasıdır.',
    validateSuccess: 'İki paket: VehicleDomain (yapı) ve Requirements (gereksinimler).',
    validateError: '`package Requirements { requirement def MassReq { } }` ekleyin.',
  },

  l14t4: {
    levelName: 'Paketler ve İçe Aktarma',
    title: 'İçe Aktarmayı Kullan',
    instruction:
      '**import** ifadesi diğer paketlerdeki öğeleri görünür kılar.\n\n' +
      '**Requirements** içine ekleyin:\n' +
      '`import VehicleDomain::*;`\n\n' +
      'Bu, VehicleDomain\'deki tüm öğeleri içe aktarır.',
    hint: 'Requirements { } içine: `import VehicleDomain::*;` ekleyin.',
    concept: 'import',
    conceptExplanation:
      '`import PackageName::*` tüm açık üyeleri içe aktarır. ' +
      '`import PackageName::TypeName` belirli bir öğeyi içe aktarır. ' +
      'İçe aktarma olmadan tam nitelikli ad kullanmanız gerekir.',
    validateSuccess: 'Requirements artık Vehicle, Engine ve Wheel\'e doğrudan referans verebilir.',
    validateError: 'Requirements { } içine: `import VehicleDomain::*;` ekleyin.',
  },

  l14t5: {
    levelName: 'Paketler ve İçe Aktarma',
    title: 'İç İçe Paketler Oluştur',
    instruction:
      'Paketler iç içe geçebilir. **VehicleDomain** içine ekleyin:\n\n' +
      '`package Powertrain { }` içine `part def Turbo { }` ekleyin.',
    hint: 'VehicleDomain içine: `package Powertrain { part def Turbo { } }` ekleyin.',
    concept: 'nested packages',
    conceptExplanation:
      'İç içe paketler daha derin ad alanları oluşturur: VehicleDomain::Powertrain::Turbo. ' +
      'Bu, büyük modelleri mantıksal gruplara ayırmaya yardımcı olur.',
    validateSuccess: 'İç içe paket: VehicleDomain::Powertrain::Turbo. Model iyi organize edildi!',
    validateError: 'VehicleDomain içine: `package Powertrain { part def Turbo { } }` ekleyin.',
  },

  l14t6: {
    levelName: 'Paketler ve İçe Aktarma',
    title: 'Belirli İçe Aktarma',
    instruction:
      'Joker karakter yerine belirli bir öğeyi içe aktarın.\n\n' +
      'Yeni bir `package Testing { }` içine ekleyin:\n' +
      '`import VehicleDomain::Vehicle;`\n\n' +
      'Bu yalnızca Vehicle\'ı içe aktarır, Engine veya Wheel\'i değil.',
    hint: '`package Testing { import VehicleDomain::Vehicle; }` ekleyin.',
    concept: 'specific import',
    conceptExplanation:
      'Belirli içe aktarmalar daha kesindir: `import Pkg::Name` yalnızca o öğeyi içe aktarır. ' +
      'Joker `::*` kolaydır ama büyük modellerde ad çakışmalarına yol açabilir.',
    validateSuccess: 'Belirli içe aktarma: Testing içinde yalnızca Vehicle görünür. Paketler ustalaştı!',
    validateError: '`package Testing { import VehicleDomain::Vehicle; }` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 15: Use Cases, Allocation & Views (6 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l15t1: {
    levelName: 'İleri Kavramlar',
    title: 'Kullanım Durumu Tanımı Oluştur',
    instruction:
      'Bir **use case def**, sistem kullanım senaryosunu açıklar.\n\n' +
      '`use case def DriveToWork { }` ekleyin.',
    hint: 'Yeni bir satıra `use case def DriveToWork { }` yazın.',
    concept: '«use case def»',
    conceptExplanation:
      'Kullanım durumu tanımları aktörlerin sistemle nasıl etkileşeceğini yakalar. ' +
      'Sistemi kullanıcı bakış açısından — onlar için ne yaptığını — açıklar.',
    validateSuccess: 'DriveToWork bir kullanım durumu tanımı — bir kullanım senaryosu.',
    validateError: 'Modele `use case def DriveToWork { }` ekleyin.',
  },

  l15t2: {
    levelName: 'İleri Kavramlar',
    title: 'Başka Bir Kullanım Durumu Oluştur',
    instruction:
      'Otoyolda sürüş için ikinci bir kullanım durumu ekleyin:\n\n' +
      '`use case def HighwayDrive { }`',
    hint: 'Yeni bir satıra `use case def HighwayDrive { }` yazın.',
    concept: '«use case def»',
    conceptExplanation:
      'Birden fazla kullanım durumu farklı senaryoları açıklar. ' +
      'DriveToWork ve HighwayDrive aracın farklı kullanım bağlamlarını temsil eder.',
    validateSuccess: 'İki kullanım durumu: DriveToWork ve HighwayDrive.',
    validateError: 'Modele `use case def HighwayDrive { }` ekleyin.',
  },

  l15t3: {
    levelName: 'İleri Kavramlar',
    title: 'Atama (Allocate) Kullan',
    instruction:
      '**allocate** ilişkisi mantıksal öğeleri fiziksel olanlarla eşler.\n\n' +
      'Ekleyin: `allocate DriveToWork to Vehicle;`',
    hint: 'Yeni bir satıra `allocate DriveToWork to Vehicle;` yazın.',
    concept: 'allocate',
    conceptExplanation:
      '"allocate A to B" A öğesini B öğesine alanlar arasında eşler. ' +
      'Bu, gereksinim/davranışları fiziksel yapıya bağlar.',
    validateSuccess: 'DriveToWork, Vehicle\'a atandı. Alanlar arası izlenebilirlik!',
    validateError: 'Yeni bir satıra `allocate DriveToWork to Vehicle;` ekleyin.',
  },

  l15t4: {
    levelName: 'İleri Kavramlar',
    title: 'Bakış Açısı Tanımı Oluştur',
    instruction:
      'Bir **viewpoint def**, paydaş bakış açısını tanımlar.\n\n' +
      '`viewpoint def EngineerView { }` ekleyin.',
    hint: 'Yeni bir satıra `viewpoint def EngineerView { }` yazın.',
    concept: '«viewpoint def»',
    conceptExplanation:
      'Bakış açıları paydaşın neyle ilgilendiğini — endişelerini — tanımlar. ' +
      'Farklı paydaşların (mühendis, yönetici, güvenlik analisti) farklı bakış açıları olur.',
    validateSuccess: 'EngineerView bakış açısı tanımlandı — modele mühendis bakışı.',
    validateError: 'Modele `viewpoint def EngineerView { }` ekleyin.',
  },

  l15t5: {
    levelName: 'İleri Kavramlar',
    title: 'Görünüm Tanımı Oluştur',
    instruction:
      'Bir **view def**, model içeriğini belirli bir bakış açısı için sunar.\n\n' +
      '`view def SystemOverview { }` ekleyin.',
    hint: 'Yeni bir satıra `view def SystemOverview { }` yazın.',
    concept: '«view def»',
    conceptExplanation:
      'Bir görünüm, bir bakış açısının endişelerine göre model öğelerini seçer ve sunar. ' +
      'Görünümler paydaşların modele baktığı "merceklerdir".',
    validateSuccess: 'SystemOverview görünümü tanımlandı. Görünümler modeli paydaşlara sunar.',
    validateError: 'Modele `view def SystemOverview { }` ekleyin.',
  },

  l15t6: {
    levelName: 'İleri Kavramlar',
    title: 'Modeli Tamamla',
    instruction:
      'Hepsini bir araya getirin! Bir konser tanımı ve bir görselleştirme tanımı oluşturun:\n\n' +
      '- `concern def Performance { }`\n' +
      '- `rendering def DiagramView { }`\n\n' +
      'Bunlar son SysML v2 öğe türleridir.',
    hint: 'Her iki tanımı da yeni satırlara ekleyin.',
    concept: 'concern & rendering',
    conceptExplanation:
      'Endişeler paydaşlar için neyin önemli olduğunu tanımlar. Görselleştirmeler görünümlerin nasıl gösterileceğini tanımlar. ' +
      'Bakış açıları ve görünümlerle birlikte sunum modelini tamamlarlar.',
    validateSuccess: 'Tebrikler! SysML v2 dilinin tamamını kapsayan 100 eğitim görevini tamamladınız!',
    validateError: '`concern def Performance { }` ve `rendering def DiagramView { }` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 16: Flows & Messages (5 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l16t1: {
    levelName: 'Akışlar ve Mesajlar',
    title: 'Eylemler Arasında Akış Oluştur',
    instruction:
      'Bir **flow**, bir kaynak çıktısından bir hedef girdisine öğeleri aktarır.\n\n' +
      'Eylem parametrelerini bağlamak için `from ... to ...` söz dizimiyle `flow` kullanın.\n\n' +
      'Ekleyin: `flow generator.torqueOut to amplifier.torqueIn;`',
    hint: '`flow kaynak.çıktı to hedef.girdi;` söz dizimini kullanın.',
    concept: '«flow»',
    conceptExplanation: 'Akış, aktarım yönünü gösteren içi dolu üçgen başlı düz bir çizgidir.',
    validateSuccess: 'Akış oluşturuldu — öğeler kaynak çıktıdan hedef girdiye aktarılır.',
    validateError: 'providePower içine bir flow ifadesi ekleyin.',
  },

  l16t2: {
    levelName: 'Akışlar ve Mesajlar',
    title: 'Succession Akışı Ekle',
    instruction:
      'Bir **succession flow**, sıralama ekler: kaynak, aktarım başlamadan tamamlanmalıdır.\n\n' +
      '`flow` yerine `succession flow` kullanın.\n\n' +
      'Ekleyin: `succession flow focus.image to shoot.image;`',
    hint: '`succession flow X.out to Y.in;` söz dizimini kullanın.',
    concept: '«succession flow»',
    conceptExplanation: 'Succession flow, içi dolu üçgen başlı kesikli bir çizgidir — aktarım ile sıralamayı birleştirir.',
    validateSuccess: 'Succession flow eklendi — image, shoot\'a aktarılmadan önce focus tamamlanmalı.',
    validateError: 'takePicture içine `succession flow focus.image to shoot.image;` ekleyin.',
  },

  l16t3: {
    levelName: 'Akışlar ve Mesajlar',
    title: 'Yük (Payload) ile Akış Ekle',
    instruction:
      'Bir akış, aktarılan şeyi `of` kullanarak belirtebilir.\n\n' +
      'Ekleyin: `flow of Fuel from tank.fuelOut to engine.fuelIn;`',
    hint: '`flow of Tip from X to Y;` söz dizimini kullanın.',
    concept: '«flow» of Payload',
    conceptExplanation: '`of` anahtar sözcüğü aktarılan yük tipini belirler.',
    validateSuccess: 'Fuel yüküyle akış oluşturuldu — diyagram aktarılan şeyi gösterir.',
    validateError: '`of` yük belirtimi ile bir akış ekleyin.',
  },

  l16t4: {
    levelName: 'Akışlar ve Mesajlar',
    title: 'Mesaj Oluştur',
    instruction:
      'Bir **message**, parçalar arasında soyut bir aktarımdır — mekanizmayı belirtmeden ne gönderildiğini söyler.\n\n' +
      'Ekleyin: `message of ControlSignal from controller to engine;`',
    hint: '`message of Tip from X to Y;` söz dizimini kullanın.',
    concept: '«message»',
    conceptExplanation: 'Mesaj, içi dolu üçgen başlı düz bir çizgi olarak (mor) gösterilir. Akıştan farklı olarak kaynak/hedef özelliklerini belirtmez.',
    validateSuccess: 'Mesaj oluşturuldu — parçalar arasında soyut bir ControlSignal aktarımı.',
    validateError: 'vehicle içine bir message ifadesi ekleyin.',
  },

  l16t5: {
    levelName: 'Akışlar ve Mesajlar',
    title: 'Akış Tanımı Oluştur',
    instruction:
      'Bir **flow def**, yük ve uçlarıyla birlikte yeniden kullanılabilir bir akış tipini tanımlar.\n\n' +
      'Ekleyin: `flow def FuelFlow;`',
    hint: '`flow def Ad;` söz dizimini kullanın.',
    concept: '«flow def»',
    conceptExplanation: 'Akış tanımı bir aktarım türünü sınıflar. Akış kullanımları ona atıfta bulunabilir.',
    validateSuccess: 'Akış tanımı oluşturuldu — yeniden kullanılabilir bir aktarım tipi.',
    validateError: '`flow def FuelFlow;` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 17: Perform & Exhibit (5 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l17t1: {
    levelName: 'Perform ve Exhibit',
    title: 'Bir Parçada Eylem Gerçekleştir',
    instruction:
      'Bir parça bir eylemi **perform** edebilir (gerçekleştirebilir) — bu, eylemin parçanın yaşamı boyunca meydana geldiği anlamına gelir.\n\n' +
      'Vehicle içine ekleyin: `perform action drive : Drive;`',
    hint: 'Bir parça içinde `perform action ad : ActionDef;` kullanın.',
    concept: '«perform»',
    conceptExplanation: 'Perform action kullanımı, ana parça içinde «perform» anahtar sözcüğüyle yuvarlatılmış dikdörtgen olarak görünür.',
    validateSuccess: 'Vehicle artık drive eylemini gerçekleştiriyor!',
    validateError: 'Vehicle içine `perform action drive : Drive;` ekleyin.',
  },

  l17t2: {
    levelName: 'Perform ve Exhibit',
    title: 'Birden Fazla Perform Eylemi Ekle',
    instruction:
      'Bir parça birden fazla eylem gerçekleştirebilir.\n\n' +
      'İkinci bir perform ekleyin: `perform action brake : Brake;`',
    hint: 'Başka bir `perform action ad : ActionDef;` satırı ekleyin.',
    concept: '«perform»',
    conceptExplanation: 'Birden fazla perform kullanımı, ana parça içinde iç içe yuvarlatılmış dikdörtgenler olarak görünür.',
    validateSuccess: 'Vehicle hem drive hem brake eylemlerini gerçekleştiriyor!',
    validateError: 'Vehicle içine `perform action brake : Brake;` ekleyin.',
  },

  l17t3: {
    levelName: 'Perform ve Exhibit',
    title: 'Bir Parçada Durum Sergile',
    instruction:
      'Bir parça bir durumu **exhibit** edebilir (sergileyebilir) — bu, parçanın yaşamı boyunca o durum geçişlerinden geçtiği anlamına gelir.\n\n' +
      'Ekleyin: `exhibit state vehicleStates : VehicleStates;`',
    hint: 'Bir parça içinde `exhibit state ad : StateDef;` kullanın.',
    concept: '«exhibit»',
    conceptExplanation: 'Exhibit state kullanımı «exhibit» anahtar sözcüğüyle yuvarlatılmış dikdörtgen olarak gösterilir ve parçayı davranışsal durumlarına bağlar.',
    validateSuccess: 'Vehicle artık VehicleStates\'i sergiliyor!',
    validateError: 'Vehicle içine `exhibit state vehicleStates : VehicleStates;` ekleyin.',
  },

  l17t4: {
    levelName: 'Perform ve Exhibit',
    title: 'Perform ve Exhibit\'i Birleştir',
    instruction:
      'Bir parça hem eylemler gerçekleştirebilir hem de durumlar sergileyebilir.\n\n' +
      'İkisini de ekleyin:\n- `perform action drive : Drive;`\n- `exhibit state states : VehicleStates;`',
    hint: 'Parça içine hem perform hem de exhibit ekleyin.',
    concept: 'perform + exhibit',
    conceptExplanation: 'Perform ve exhibit kullanımları birlikte bir parçanın hem yürüttüğü eylemleri hem de geçtiği durumları tanımlar.',
    validateSuccess: 'Vehicle hem eylemler gerçekleştiriyor hem durumlar sergiliyor!',
    validateError: 'Vehicle içine perform ve exhibit ekleyin.',
  },

  l17t5: {
    levelName: 'Perform ve Exhibit',
    title: 'Entry, Do ve Exit Eylemleri',
    instruction:
      'Durumların durum geçişleri sırasında çalışan **entry**, **do** ve **exit** eylemleri olabilir.\n\n' +
      '`on` durumu içine ekleyin:\n- `entry action startup;`\n- `do action running;`\n- `exit action shutdown;`',
    hint: 'Bir durum içinde `entry action ad;`, `do action ad;`, `exit action ad;` kullanın.',
    concept: 'entry / do / exit',
    conceptExplanation: 'Entry eylemleri duruma girilirken çalışır. Do eylemleri durum aktifken çalışır. Exit eylemleri durumdan çıkılırken çalışır.',
    validateSuccess: 'on durumu artık entry, do ve exit eylemlerine sahip!',
    validateError: 'on durumu içine entry/do/exit eylemleri ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 18: Comments & Documentation (4 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l18t1: {
    levelName: 'Yorumlar ve Belgeleme',
    title: 'İsimlendirilmiş Yorum Ekle',
    instruction:
      'SysML v2 **yorumları** model öğeleri olarak destekler. İsimlendirilmiş bir yorum diyagramda köşesi katlanmış bir not olarak görünür.\n\n' +
      'Ekleyin: `comment DesignNote /* This is a design note. */`',
    hint: '`comment Ad /* metin */` söz dizimini kullanın.',
    concept: '«comment»',
    conceptExplanation: 'Yorum, belgeleme metni içeren köşesi katlanmış dikdörtgendir (not şekli).',
    validateSuccess: 'İsimlendirilmiş yorum bir diyagram öğesi olarak oluşturuldu!',
    validateError: '`comment DesignNote /* This is a design note. */` ekleyin.',
  },

  l18t2: {
    levelName: 'Yorumlar ve Belgeleme',
    title: 'Bir Öğe Hakkında Yorum Ekle',
    instruction:
      'Bir yorum `about` kullanarak belirli bir öğeye not düşebilir.\n\n' +
      'Ekleyin: `comment about Vehicle /* The main system element. */`',
    hint: '`comment about ÖğeAdı /* metin */` söz dizimini kullanın.',
    concept: '«annotate»',
    conceptExplanation: '`about` ile bir yorum, notu açıklanan öğeye bağlayan kesikli bir çizgi oluşturur.',
    validateSuccess: 'Yorum, Vehicle\'a kesikli bir çizgiyle not düşüyor!',
    validateError: '`comment about Vehicle /* The main system element. */` ekleyin.',
  },

  l18t3: {
    levelName: 'Yorumlar ve Belgeleme',
    title: 'Belgeleme Ekle',
    instruction:
      'Bir **doc** yorumu kendi sahibi olan öğeyi belgeler. Belgeleme bölmesinde görünür.\n\n' +
      'Vehicle içine ekleyin: `doc /* The primary vehicle system. */`',
    hint: 'Tanımın içinde `doc /* metin */` kullanın.',
    concept: 'doc',
    conceptExplanation: 'Belgeleme yorumları, içeren öğeye aittir ve onu açıklar.',
    validateSuccess: 'Vehicle\'a belgeleme eklendi!',
    validateError: 'Vehicle içine `doc /* The primary vehicle system. */` ekleyin.',
  },

  l18t4: {
    levelName: 'Yorumlar ve Belgeleme',
    title: 'Takma Ad (Alias) Ekle',
    instruction:
      'Bir **alias**, bir öğe için alternatif bir ad oluşturur.\n\n' +
      'Ekleyin: `alias Car for Vehicle;`',
    hint: '`alias AltAd for OrijinalAd;` söz dizimini kullanın.',
    concept: '«alias»',
    conceptExplanation: 'Takma adlar yeni öğe oluşturmadan alternatif adlar sağlar.',
    validateSuccess: 'Takma ad oluşturuldu — Car artık Vehicle için alternatif bir ad.',
    validateError: '`alias Car for Vehicle;` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 19: Conjugated Ports & Interfaces (4 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l19t1: {
    levelName: 'Eşlenik Portlar ve Arayüzler',
    title: 'Yönlü Özelliklere Sahip Port Oluştur',
    instruction:
      'Bir port tanımı, akış yönlerini belirten **in** ve **out** özelliklerine sahip olabilir.\n\n' +
      'Port def\'in içine `out item fuelOut : Fuel;` ve `in item fuelReturn : Fuel;` ekleyin.',
    hint: 'Port def içinde `in item ad : Tip;` ve `out item ad : Tip;` kullanın.',
    concept: 'directed features',
    conceptExplanation: 'Yönlü özellikler bir porttan ne girip ne çıkacağını belirler. In/out birbirinin eşleniğidir.',
    validateSuccess: 'Port yönlü özelliklere sahip — yakıt dışarı akar ve geri döner!',
    validateError: 'FuelingPort içine `out item fuelOut : Fuel;` ve `in item fuelReturn : Fuel;` ekleyin.',
  },

  l19t2: {
    levelName: 'Eşlenik Portlar ve Arayüzler',
    title: 'Eşlenik Port Kullan',
    instruction:
      'Bir **eşlenik port**, `~` öneki ile in/out yönlerini tersine çevirir.\n\n' +
      'FuelingPort\'un `out fuelOut`\'u varsa, `~FuelingPort`\'un `in fuelOut`\'u olur.\n\n' +
      'Engine içine ekleyin: `port enginePort : ~FuelingPort;`',
    hint: '`port ad : ~PortDef;` söz dizimini kullanın.',
    concept: '~PortDef (eşlenik)',
    conceptExplanation: 'Eşleniklik tüm yönlü özellikleri tersine çevirir. Yakıt gönderen bir port, yakıt alan bir eşlenik porta bağlanır.',
    validateSuccess: 'Eşlenik port oluşturuldu — yönler tersine döndü!',
    validateError: 'Engine içine `port enginePort : ~FuelingPort;` ekleyin.',
  },

  l19t3: {
    levelName: 'Eşlenik Portlar ve Arayüzler',
    title: 'Arayüz Tanımı Oluştur',
    instruction:
      'Bir **interface def**, portlar arasındaki bir bağlantı tipini tanımlar.\n\n' +
      'Ekleyin: `interface def FuelInterface;`',
    hint: '`interface def Ad;` söz dizimini kullanın.',
    concept: '«interface def»',
    conceptExplanation: 'Arayüz tanımları portlar arasındaki bağlantıları sınıflar, aralarında neyin akacağını belirler.',
    validateSuccess: 'Arayüz tanımı oluşturuldu!',
    validateError: '`interface def FuelInterface;` ekleyin.',
  },

  l19t4: {
    levelName: 'Eşlenik Portlar ve Arayüzler',
    title: 'Bind Bağlantısı Oluştur',
    instruction:
      'Bir **bind** bağlantısı, iki özelliğin her zaman aynı değere sahip olduğunu ifade eder.\n\n' +
      'Ekleyin: `bind sensor.reading = controller.input;`',
    hint: '`bind X = Y;` söz dizimini kullanın.',
    concept: 'bind',
    conceptExplanation: 'Bağlama, her iki ucunda açık daireler olan kesikli bir çizgi olarak gösterilir.',
    validateSuccess: 'Bağlama oluşturuldu — sensor okuması her zaman controller girdisine eşit!',
    validateError: 'system içine `bind sensor.reading = controller.input;` ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 20: Conditional Guards & Control Flow (5 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l20t1: {
    levelName: 'Koşullu Korumalar',
    title: 'Koşullu Succession Ekle',
    instruction:
      'Bir succession bir **koruma** (guard) içerebilir — akışın devam etmesi için doğru olması gereken bir koşul.\n\n' +
      'Ekleyin: `if isReady then startProcess;`',
    hint: '`if korumaİfadesi then eylemAdı;` söz dizimini kullanın.',
    concept: '[guard]',
    conceptExplanation: 'Korumalar succession kenarlarında [ifade] etiketleri olarak görünür. Akış yalnızca koşul doğru olduğunda devam eder.',
    validateSuccess: 'Koşullu koruma eklendi — akış yalnızca koşul doğruyken devam eder!',
    validateError: 'decide düğümünden sonra `if isReady then startProcess;` ekleyin.',
  },

  l20t2: {
    levelName: 'Koşullu Korumalar',
    title: 'If-Then-Else Ekle',
    instruction:
      'Bir **if-then-else** bir karardan iki dal sağlar.\n\n' +
      'Ekleyin:\n- `if isNormal then processNormal;`\n- `if isError then processError;`',
    hint: 'decide düğümünden sonra iki `if ... then ...;` ifadesi ekleyin.',
    concept: 'if-then-else',
    conceptExplanation: 'Bir karardan çıkan birden çok koruma dallanan yollar oluşturur. Her koruma kendi succession kenarını etiketler.',
    validateSuccess: 'Karar düğümünden iki koşullu dal oluşturuldu!',
    validateError: 'İki `if ... then ...;` ifadesi ekleyin.',
  },

  l20t3: {
    levelName: 'Koşullu Korumalar',
    title: 'Dallardan Sonra Merge Kullan',
    instruction:
      'Bir **merge** düğümü koşullu dalları geri birleştirir.\n\n' +
      'Ekleyin:\n- `first processNormal then merge1;`\n- `first processError then merge1;`\n- `merge merge1;`\n- `first merge1 then done;`',
    hint: '`merge merge1;` tanımlayın ve her iki dalı oraya yönlendirin.',
    concept: 'merge',
    conceptExplanation: 'Bir merge baklava şekli birden fazla yolu tek bir yolda toplar. Akış, gelen herhangi bir dal tamamlandığında devam eder.',
    validateSuccess: 'Merge düğümü her iki dalı topluyor — koşullu akış tamam!',
    validateError: '`merge merge1;` ekleyin ve dalları oraya yönlendirin.',
  },

  l20t4: {
    levelName: 'Koşullu Korumalar',
    title: 'Paralel Eylemler için Fork ve Join',
    instruction:
      'Bir **fork** akışı paralel yollara böler. Bir **join** tüm yolların tamamlanmasını bekler.\n\n' +
      'Fork, iki paralel eylem ve onları geri birleştiren bir join ekleyin.',
    hint: '`fork fork1;` sonra `first fork1 then actionA;` ve `first fork1 then actionB;` kullanın.',
    concept: 'fork / join',
    conceptExplanation: 'Fork (kalın çubuk) eşzamanlı eylemlere böler. Join (kalın çubuk) onları geri senkronlar.',
    validateSuccess: 'Fork paralel yollara bölüyor, join onları senkronluyor!',
    validateError: '`fork fork1;` ve `join join1;` paralel eylem yönlendirmesiyle ekleyin.',
  },

  l20t5: {
    levelName: 'Koşullu Korumalar',
    title: 'Eksiksiz Kontrol Akış Deseni',
    instruction:
      'Eksiksiz bir eylem oluşturun: start → fork → paralel eylemler → join → decide → koşullu dallar → merge → done.\n\n' +
      'Bu, tek bir akışta tüm kontrol düğümlerini çalıştırır.',
    hint: 'fork/join, decide/merge ve koşullu korumaları birleştirin.',
    concept: 'Eksiksiz kontrol akışı',
    conceptExplanation: 'Eksiksiz bir eylem akışı, tüm SysML v2 kontrol düğüm türlerinin birlikte çalışmasını gösterir.',
    validateSuccess: 'Tüm düğüm türleriyle eksiksiz kontrol akışı — tebrikler!',
    validateError: 'fork/join/decide/merge ve koşullu korumalarla tam akışı kurun.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 21: Occurrences & Interactions (3 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l21t1: {
    levelName: 'Olaylar ve Etkileşimler',
    title: 'Olay Tanımı Oluştur',
    instruction:
      'Bir **occurrence def**, uzayda ve zamanda meydana gelen bir şeyi tanımlar.\n\n' +
      'Olaylar tüm davranışsal tiplerin temelidir — eylemler, durumlar ve olaylar hepsi özelleştirmelerdir.\n\n' +
      'Ekleyin: `occurrence def CrashEvent;`',
    hint: '`occurrence def Ad;` söz dizimini kullanın.',
    concept: '«occurrence def»',
    conceptExplanation: 'Bir occurrence tanımı genel amaçlı zamansal bir tiptir. Eylemler ve durumlar onun özelleştirmeleridir.',
    validateSuccess: 'Occurrence tanımı oluşturuldu — uzayda ve zamanda meydana gelen bir şey.',
    validateError: '`occurrence def CrashEvent;` ekleyin.',
  },

  l21t2: {
    levelName: 'Olaylar ve Etkileşimler',
    title: 'Event Occurrence Kullan',
    instruction:
      'Bir **event occurrence** bir davranış içinde bir anı işaretler — bir sinyal veya tetikleyici.\n\n' +
      'Eylem içine iki event ekleyin:\n' +
      '- `event occurrence driverReady;`\n' +
      '- `event occurrence doorClosed;`',
    hint: 'Bir eylem veya parça içinde `event occurrence ad;` kullanın.',
    concept: '«event occurrence»',
    conceptExplanation: 'Event\'ler zamanda anları işaretler. Geçişleri veya dizileri tetikleyebilirler.',
    validateSuccess: 'Event\'ler oluşturuldu — driverReady ve doorClosed eylemde anları işaretliyor.',
    validateError: 'StartVehicle içine event occurrence\'lar ekleyin.',
  },

  l21t3: {
    levelName: 'Olaylar ve Etkileşimler',
    title: 'Event\'ler ve Mesajlar',
    instruction:
      '**Event**\'leri ve **mesajları** gerçekçi bir senaryoda birleştirin.\n\n' +
      'StartVehicle içine ekleyin:\n' +
      '- Bir send eylemi: `action turnOn send vs : VehicleStart to vehicle.controlPort;`\n' +
      '- Bir mesaj: `message of VehicleStart from turnOn to waitForStart;`',
    hint: '`send ad : Tip to hedef;` ve `message of Tip from X to Y;` kullanın.',
    concept: 'event + message',
    conceptExplanation: 'Send eylemleri öğe üretir. Mesajlar bir sıralama içindeki yaşam çizgileri arasında soyut aktarımları modeller.',
    validateSuccess: 'Event\'ler, send eylemleri ve mesajlar birlikte çalışıyor — eksiksiz bir iletişim dizisi.',
    validateError: 'StartVehicle içine hem bir send eylemi hem de bir mesaj ekleyin.',
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SEVİYE 22: Individual, Snapshot & Timeslice (5 görev)
  // ════════════════════════════════════════════════════════════════════════════

  l22t1: {
    levelName: 'Bireysel ve Zamansal',
    title: 'Bireysel (Individual) Tanım Oluştur',
    instruction:
      'Bir **individual def**, belirli ve eşsiz bir örneği tanımlar — bir sınıf değil, somut bir varlık.\n\n' +
      'SysML v2\'de `individual`, bir tanımın gerçeklikte tam olarak tek bir şeyi temsil ettiğini işaretler.\n\n' +
      'Ekleyin: `individual def Vehicle_1 :> Vehicle;`',
    hint: 'Belirli bir bireyi tanımlamak için `individual def Ad :> ÜstTanım;` kullanın.',
    concept: '«individual occurrence def»',
    conceptExplanation: 'Bireysel tanım, belirli bir örneği temsil eden bir occurrence\'dır — "genel olarak arabalar" yerine "bu araba".',
    validateSuccess: 'Bireysel tanım oluşturuldu — Vehicle_1 belirli bir araç, bir sınıf değil.',
    validateError: '`individual def Vehicle_1 :> Vehicle;` ekleyin.',
  },

  l22t2: {
    levelName: 'Bireysel ve Zamansal',
    title: 'Bireysel Kullanım Oluştur',
    instruction:
      'Bir **individual** kullanımı, belirli bir örnek için bağlam oluşturur — onun yaşamını modellediğimiz yer.\n\n' +
      'Ekleyin: `individual myVehicle : Vehicle_1 { }`',
    hint: '`individual ad : BireyselTanım { }` söz dizimini kullanın.',
    concept: '«individual occurrence»',
    conceptExplanation: 'Bireysel kullanım, belirli bir örneği zaman içinde gözlemlediğimiz bağlamı sağlar.',
    validateSuccess: 'Bireysel kullanım oluşturuldu — myVehicle, Vehicle_1\'i gözlemlemek için bağlamdır.',
    validateError: 'Bireysel tanımdan sonra `individual myVehicle : Vehicle_1 { }` ekleyin.',
  },

  l22t3: {
    levelName: 'Bireysel ve Zamansal',
    title: 'Snapshot Ekle',
    instruction:
      'Bir **snapshot**, bir bireyin belirli bir andaki durumunu yakalar.\n\n' +
      '`myVehicle` içine ekleyin: `snapshot t0 { }`\n\n' +
      'Bu, "t0 zamanındaki myVehicle\'ın durumu"nu temsil eder.',
    hint: 'Bir bireysel kullanım içinde `snapshot ad { }` kullanın.',
    concept: '«snapshot»',
    conceptExplanation: 'Bir snapshot, portionKind=snapshot olan bir occurrence kullanımıdır — bireyin yaşamındaki bir anı yakalar.',
    validateSuccess: 'Snapshot\'lar oluşturuldu — t0 ve t1, myVehicle\'ı iki ayrı anda yakalıyor.',
    validateError: 'myVehicle içine `snapshot t0 { }` ve `snapshot t1 { }` ekleyin.',
  },

  l22t4: {
    levelName: 'Bireysel ve Zamansal',
    title: 'Timeslice Ekle',
    instruction:
      'Bir **timeslice**, bir bireyin durumunu bir zaman aralığında yakalar (yalnızca bir anda değil).\n\n' +
      '`myVehicle` içine ekleyin: `timeslice t0_to_t1 { }`\n\n' +
      'Bu, "t0 ile t1 arasında myVehicle\'ın durumu"nu temsil eder.',
    hint: 'Bir bireysel kullanım içinde `timeslice ad { }` kullanın.',
    concept: '«timeslice»',
    conceptExplanation: 'Bir timeslice bir süreyi yakalar — bir bireyin durumunu bir zaman aralığında.',
    validateSuccess: 'Timeslice oluşturuldu — myVehicle\'ın bir zaman aralığındaki durumunu yakalıyor.',
    validateError: 'myVehicle içine `timeslice t0_to_t1 { }` ekleyin.',
  },

  l22t5: {
    levelName: 'Bireysel ve Zamansal',
    title: 'Eksiksiz Zamansal Model',
    instruction:
      '**Individual**, **snapshot**\'lar, **timeslice** ve **succession**\'larla eksiksiz bir zamansal model kurun.\n\n' +
      'Bir yol gezisi modelleyin: araç t0\'da (ev) başlar, t1\'e (varış) gider, yolculuk için bir timeslice ile.\n\n' +
      'Succession\'lar ekleyin: `first t0 then trip;` ve `first trip then t1;`',
    hint: 'Snapshot ve timeslice\'ları zamanda sıralamak için `first X then Y;` kullanın.',
    concept: 'temporal modeling',
    conceptExplanation: 'Bir varlığın zamandaki eksiksiz yaşam döngüsünü modellemek için individual + snapshot\'lar + timeslice + succession\'ları birleştirin.',
    validateSuccess: 'Eksiksiz zamansal model — yola çıkış ve varış anlarındaki snapshot\'lar, yolculuk için bir timeslice, zamanda sıralanmış.',
    validateError: 'Snapshot\'ları ve timeslice\'ı zamanda sıralamak için succession\'lar ekleyin.',
  },

};

// Turkish overrides for legend item explanations.
// Keys are the English `label` field from LEGEND_ITEMS so the lookup is direct.
export const LEGEND_EXPLANATIONS_TR: Record<string, string> = {
  '«part def»':
    'Bir parça tanımı sistemlerin veya sistem parçalarının bir sınıfını tanımlar. ' +
    'Bir şablondur — örnek değil, bir tip. Diyagramda köşeli dikdörtgenle gösterilir.',
  'attribute':
    'Tipli bir özellik. İki nokta üst üste adı tipinden ayırır. ' +
    'Yerleşik tipler: Real, Integer, Boolean, String.',
  'Specialization  :>':
    ':> "özelleştirir" anlamına gelir. Özelleştirilmiş tanım, genel tanımın tüm özelliklerini miras alır. ' +
    'İçi boş üçgen başlı bir çizgi olarak gösterilir.',
  '«part» usage':
    'Bir part kullanımı kompozit bir özelliktir — "Vehicle bir Engine\'e sahip". ' +
    'Bir kompozisyon ilişkisi oluşturur. Yuvarlatılmış köşeli dikdörtgen.',
  'multiplicity [n]':
    '[4] tam olarak dört örnek demek. [1..*] bir veya daha fazla. [*] üst sınırsız. Varsayılan 1..1.',
  'Subsetting  :>':
    'Kullanımlar üzerinde :> "alt-kümeler" anlamına gelir. Alt-küme özelliğin değerleri, alt-kümelenen özelliğin değerlerinin bir alt kümesidir.',
  'Redefinition  :>>':
    ':>> miras alınan bir özelliği yeni bir ad ve/veya özelleştirilmiş tiple değiştirir.',
  '«port def»':
    'Bir port tanımı bir sistem sınırında mevcut özellikleri tanımlar. ' +
    'Portlar yönlü özelliklere (in, out, inout) sahip olabilir.',
  'port usage':
    'Bir port kullanımı bir bloğun sınırına bir bağlantı noktası yerleştirir.',
  'in / out / inout':
    'Yönlü özellikler portlardan akış yönünü belirtir. ' +
    '"in" alır, "out" gönderir, "inout" her ikisini yapar.',
  '«item def»':
    'Bir öğe, bağlantılar üzerinden akan şeyleri tanımlar: veri, sinyal veya malzeme.',
  '«connection def»':
    'Bir bağlantı tanımı, parçalar arasında portlar üzerinden kurulan bir bağlantı tipini belirler.',
  '«enum def»':
    'Bir sayım türü, isimlendirilmiş sabit bir değer kümesini tanımlar. Her değer enum tipinin bir üyesidir.',
  '«action def»':
    'Bir eylem tanımı bir davranış veya adım tanımlar. Eylemlerin in/out parametreleri, ' +
    'iç içe eylem kullanımları ve succession\'ları olabilir.',
  'succession (then)':
    '"first ... then ..." action kullanımları arasında çalışma sırasını belirler. ' +
    'Bir succession yönlü zamansal bir ilişkidir.',
  'fork / join':
    'Fork akışı eşzamanlı dallara böler. Join eşzamanlı dalları geri senkronlar.',
  'decide / merge':
    'Decide birden çok dal arasından korumalara göre birini seçer. Merge alternatif dalları birleştirir.',
  '«state def»':
    'Bir durum tanımı, bir sistemin yaşam döngüsünü modelleyen durum ve geçişler kümesini tanımlar.',
  'transition (then)':
    'Bir geçiş bir durum değişimini tanımlar. "first S1 then S2" S1 durumundan S2 durumuna geçer.',
  '«requirement def»':
    'Bir gereksinim tanımı, bir sistemin sağlaması gereken koşulu yakalar. ' +
    'Belgeleme metni ve bir özne içerebilir.',
  'satisfy / verify':
    '"satisfy" bir tasarım öğesinin bir gereksinimi karşıladığını ifade eder. ' +
    '"verify" bir testin bir gereksinimi doğruladığını ifade eder.',
  '«constraint def»':
    'Bir kısıt tanımı, doğru olması gereken bir mantıksal koşulu (yüklem) tanımlar.',
  '«calc def»':
    'Bir hesaplama tanımı, tipli in/out parametrelerle bir hesaplamayı tanımlar.',
  'package':
    'Bir paket, ilgili tanımları gruplandıran bir ad alanıdır. ' +
    'Paketler diğer paketleri, tanımları ve içe aktarmaları içerebilir.',
  'import':
    'İçe aktarma diğer paketlerdeki öğeleri görünür kılar. ' +
    '::* tüm üyeleri içe aktarır. ::Ad belirli bir öğeyi içe aktarır.',
  '«use case def»':
    'Bir kullanım durumu tanımı, sistemin bir aktör tarafından kullanım senaryosunu açıklar.',
  '«view def» / «viewpoint def»':
    'Bir viewpoint paydaş endişelerini tanımlar. Bir view bir viewpoint için model içeriğini sunar.',
  '«interface def»':
    'Bir arayüz tanımı, parçalar arasında bir etkileşim noktasını tanımlayan özellikleri belirler.',
  '«allocation def»':
    'Bir atama mantıksal öğeleri (işlevler, gereksinimler) fiziksel öğelere (parçalar, bileşenler) eşler.',
  '«occurrence def»':
    'Bir occurrence tanımı, uzayda ve zamanda meydana gelen bir şeyi tanımlar — olaylar, durumlar veya fenomenler.',
  '«metadata def»':
    'Bir metadata tanımı, araçlar veya izlenebilirlik için model öğelerine uygulanabilecek notlandırmaları tanımlar.',
  '«concern def»':
    'Bir concern tanımı, viewpoint\'ler ve view\'lar tarafından ele alınacak bir paydaş ilgisini yakalar.',
  '«verification case def»':
    'Bir verification case, bir gereksinimin karşılanıp karşılanmadığını teyit eden bir test veya analiz tanımlar.',
  '«analysis case def»':
    'Bir analysis case, bir sistem özelliğini değerlendirmek için hedef, özne ve hesaplama içeren bir çalışma tanımlar.',
  '«calc def»  (shape)':
    'Bir hesaplama tanımı, tipli parametreler ve bir dönüş değeri ile bir hesaplamayı tanımlar.',
  '«individual def»':
    'Bir bireysel tanım, belirli ve eşsiz bir örneği temsil eder — "genel olarak arabalar" değil "bu araba".',
  '«snapshot»':
    'Bir snapshot, bir bireyin belirli bir andaki durumunu yakalar.',
  '«timeslice»':
    'Bir timeslice, bir bireyin durumunu bir zaman aralığında yakalar.',
};
