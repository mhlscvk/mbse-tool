// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  message: string;
  severity: 'success' | 'hint' | 'error';
}

export interface TrainingTask {
  id: string;
  level: number;
  levelName: string;
  title: string;
  instruction: string; // supports **bold** and `code` markers
  hint: string;
  concept: string;
  conceptExplanation: string;
  starterCode: string;
  targetCode: string; // shown read-only in the notation mirror
  validate: (code: string) => ValidationResult;
}

export type LegendShapeType =
  | 'definition'
  | 'usage'
  | 'attribute'
  | 'port'
  | 'item'
  | 'edge-generalization'
  | 'edge-composition'
  | 'edge-subsetting'
  | 'edge-redefinition';

export interface LegendItem {
  label: string;
  shapeType: LegendShapeType;
  textualSyntax: string;
  explanation: string;
  minLevel: number;
}

// ─── Legend items (unlocked progressively by level) ──────────────────────────

export const LEGEND_ITEMS: LegendItem[] = [
  {
    label: '«part def»',
    shapeType: 'definition',
    textualSyntax: 'part def Vehicle { }',
    explanation:
      'A part definition defines a class of systems or parts of systems. ' +
      'It is a blueprint — a type, not an instance. In the diagram: sharp-cornered rectangle with a keyword header.',
    minLevel: 1,
  },
  {
    label: 'attribute',
    shapeType: 'attribute',
    textualSyntax: '  attribute mass : Real;',
    explanation:
      'A typed property of a definition. The colon separates the name from its type. ' +
      'Built-in types include Real, Integer, Boolean, and String. Appears in the compartment below the name.',
    minLevel: 2,
  },
  {
    label: 'Specialization  :>',
    shapeType: 'edge-generalization',
    textualSyntax: 'part def PoweredVehicle :> Vehicle { }',
    explanation:
      ':> is the specialization operator (equivalent to the "specializes" keyword). ' +
      'A specialized definition defines a subset of its generalization and inherits all its features. ' +
      'Shown as a solid line with a hollow triangle arrowhead.',
    minLevel: 3,
  },
  {
    label: '«part» usage',
    shapeType: 'usage',
    textualSyntax: '  part eng : Engine;',
    explanation:
      'A part usage is a composite feature — "Vehicle owns an Engine". ' +
      'The colon means "defined by" (typed by). Creates a composition relationship. ' +
      'In the diagram: rounded-corner rectangle.',
    minLevel: 3,
  },
  {
    label: 'multiplicity [n]',
    shapeType: 'usage',
    textualSyntax: '  part wheel[4] : Wheel;',
    explanation:
      '[4] means exactly four instances. [1..*] means one or more. [*] means unbounded. ' +
      'The default multiplicity for parts is 1..1.',
    minLevel: 3,
  },
  {
    label: 'Subsetting  :>',
    shapeType: 'edge-subsetting',
    textualSyntax: '  part frontWheel :> wheel;',
    explanation:
      'Subsetting (:> on usages) asserts that values of one feature are a subset of another. ' +
      'It is a kind of specialization between features. ' +
      'Shown as a solid line with a hollow triangle arrowhead, labeled "subsets".',
    minLevel: 4,
  },
  {
    label: 'Redefinition  :>>',
    shapeType: 'edge-redefinition',
    textualSyntax: '  part bigEng :>> eng;',
    explanation:
      'Redefinition (:>>) replaces an inherited feature with a new name and/or specialized type. ' +
      'A specialized definition can redefine features that would otherwise be inherited. ' +
      'Shown as a solid line with a hollow triangle arrowhead, labeled "redefines".',
    minLevel: 5,
  },
  {
    label: '«port def»',
    shapeType: 'port',
    textualSyntax: 'port def FuelPort { }',
    explanation:
      'A port definition defines features that can be made available via ports. ' +
      'Ports may have attribute and directed features (in, out, inout). ' +
      'Two ports are compatible for connection if they have matching directed features.',
    minLevel: 6,
  },
  {
    label: 'port usage',
    shapeType: 'port',
    textualSyntax: '  port fuelPort : FuelPort;',
    explanation:
      'A port usage is a connection point through which a definition makes some of its features available. ' +
      'It must reference a port definition.',
    minLevel: 6,
  },
  {
    label: '«item def»',
    shapeType: 'item',
    textualSyntax: 'item def Fuel { }',
    explanation:
      'An item definition defines a class of things that exist in space and time ' +
      'but are not necessarily parts of the system. Items model what flows through connections: ' +
      'data, signals, energy, or physical material.',
    minLevel: 7,
  },
];

// ─── Cumulative code snapshots ────────────────────────────────────────────────
// Each snapshot is syntactically valid SysML v2 text.

const S0 = `\
// Vehicle System — SysML v2 General View
// A «part def» defines a class of systems or parts of systems.
// It is a type (blueprint), not an instance.

part def Vehicle {
}
`;

const S1 = `\
part def Vehicle {
}

part def Engine {
}
`;

const S2 = `\
part def Vehicle {
}

part def Engine {
}

part def Wheel {
}
`;

const S3 = `\
part def Vehicle {
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
}
`;

const S4 = `\
part def Vehicle {
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}
`;

const S5 = `\
part def Vehicle {
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
}
`;

const S6 = `\
part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
}
`;

const S7 = `\
part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
}
`;

const S8 = `\
part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
}

part def SmallEngine :> Engine {
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;
}
`;

const S9 = `\
part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
}

part def SmallEngine :> Engine {
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;
}

port def FuelPort {
}
`;

const S10 = `\
part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
}

part def SmallEngine :> Engine {
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;
}

port def FuelPort {
}
`;

const S11 = `\
part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
}

part def SmallEngine :> Engine {
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;
}

port def FuelPort {
}

item def Fuel {
}
`;

// ─── Target codes (shown in notation mirror with NEW markers) ─────────────────

const T1 = `\
part def Vehicle {
}

// Add this below:
part def Engine {   // <-- NEW
}
`;

const T2 = `\
part def Vehicle {
}

part def Engine {
}

// Add this below:
part def Wheel {    // <-- NEW
}
`;

const T3 = `\
part def Vehicle {
}

part def Engine {
    attribute mass : Real;  // <-- NEW
}

part def Wheel {
}
`;

const T4 = `\
part def Vehicle {
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;  // <-- NEW
}
`;

const T5 = `\
part def Vehicle {
}

// ... Engine and Wheel definitions ...

// :> means "specializes" — is a kind of:
part def PoweredVehicle :> Vehicle {  // <-- NEW
}
`;

const T6 = `\
// Add part usages inside Vehicle:
part def Vehicle {
    part eng : Engine;       // <-- NEW (composition)
    part wheel[4] : Wheel;   // <-- NEW ([4] = multiplicity)
}

part def Engine { ... }
part def Wheel { ... }
part def PoweredVehicle :> Vehicle { }
`;

const T7 = `\
// Add a subsetting usage inside PoweredVehicle:
part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;  // <-- NEW
}

// frontWheel subsets (specializes) the
// inherited wheel feature from Vehicle.
// :> on a usage means "subsets".
`;

const T8 = `\
// 1. Add SmallEngine specializing Engine:
part def SmallEngine :> Engine {  // <-- NEW
}

// 2. Add SmallVehicle with redefined eng:
part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;  // <-- NEW
}

// :>> means "redefines" — replaces the
// inherited eng with smallEng.
`;

const T9 = `\
// Add a port definition:
port def FuelPort {  // <-- NEW
}

// A port definition defines a connection
// contract — what kind of connection is
// allowed at a system boundary.
`;

const T10 = `\
// Add port usage inside Vehicle:
part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;  // <-- NEW
}

// A port usage places a connection point
// on a block's boundary.
`;

const T11 = `\
// Completed Vehicle System — General View

part def Vehicle {
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}
// ... all other definitions ...

// Add this:
item def Fuel { }  // <-- NEW

// An item defines what flows through
// connections: data, signals, or material.
`;

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const TRAINING_TASKS: TrainingTask[] = [
  // ── Level 1: Part Definitions ──────────────────────────────────────────────
  {
    id: 'l1t1',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Create a Part Definition',
    instruction:
      'The diagram shows a **Vehicle** block. A **«part def»** defines a class of systems or parts of systems.\n\n' +
      'It is a type — a blueprint, not an instance. You define the blueprint once, then create usages of it many times.\n\n' +
      'Add a second part definition called **Engine** to the model.',
    hint: 'Type `part def Engine { }` on a new line below the Vehicle definition.',
    concept: '«part def»',
    conceptExplanation:
      'A Part Definition declares a reusable type. In SysML v2, types (definitions) and instances (usages) ' +
      'are always kept separate — this is the definition/usage pattern applied consistently throughout the language. ' +
      'Definitions have sharp-cornered rectangles in the diagram.',
    starterCode: S0,
    targetCode: T1,
    validate: (code) => {
      if (/part\s+def\s+Engine\b/.test(code))
        return {
          passed: true,
          message: 'Engine is now a part definition — a type blueprint. It appears as a new block in the diagram.',
          severity: 'success',
        };
      if (/\bengine\b/i.test(code))
        return {
          passed: false,
          message: 'Use both keywords: `part def Engine { }` — "part def" is required for definitions.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `part def Engine { }` on a new line.',
        severity: 'error',
      };
    },
  },

  {
    id: 'l1t2',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Add Another Part Definition',
    instruction:
      'A vehicle also needs wheels. Each concept in your system gets its own Part Definition.\n\n' +
      'Add a part definition called **Wheel** to the model.',
    hint: 'Type `part def Wheel { }` on a new line after Engine.',
    concept: '«part def»',
    conceptExplanation:
      'Part definitions are independent at this stage. Relationships between them — like composition, ' +
      'specialization, and connections — come in later levels.',
    starterCode: S1,
    targetCode: T2,
    validate: (code) => {
      if (/part\s+def\s+Wheel\b/.test(code))
        return {
          passed: true,
          message: 'Three Part Definitions. Each appears as an independent block in the diagram.',
          severity: 'success',
        };
      if (/\bwheel\b/i.test(code))
        return {
          passed: false,
          message: 'Use both keywords: `part def Wheel { }` — "part def" is required.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `part def Wheel { }` on a new line.',
        severity: 'error',
      };
    },
  },

  // ── Level 2: Attributes ────────────────────────────────────────────────────
  {
    id: 'l2t1',
    level: 2,
    levelName: 'Attributes',
    title: 'Add an Attribute to Engine',
    instruction:
      'An **attribute** is a typed property that describes a measurable or observable characteristic.\n\n' +
      'The colon `:` separates the name from its type. This is the "defined by" relationship.\n\n' +
      'Inside the **Engine** definition, add: `attribute mass : Real;`',
    hint: 'Place your cursor between the `{` and `}` of Engine, then type `attribute mass : Real;`',
    concept: 'attribute',
    conceptExplanation:
      '"attribute mass : Real" means Engine has a property called mass of type Real. ' +
      'An attribute definition may not have composite features — attribute usages are always referential. ' +
      'Built-in scalar types include Real, Integer, Boolean, and String (from the ScalarValues library).',
    starterCode: S2,
    targetCode: T3,
    validate: (code) => {
      if (/attribute\s+mass\s*:\s*Real/.test(code))
        return {
          passed: true,
          message: 'Engine now shows "+ mass : Real" in its compartment. Attributes appear below the name line.',
          severity: 'success',
        };
      if (/attribute\s+mass/.test(code))
        return {
          passed: false,
          message: 'Add the type: `attribute mass : Real;` — the ": Real" part specifies the type.',
          severity: 'hint',
        };
      if (/\bmass\b/.test(code))
        return {
          passed: false,
          message: 'Use the "attribute" keyword: `attribute mass : Real;`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Inside the Engine { } block, add: `attribute mass : Real;`',
        severity: 'error',
      };
    },
  },

  {
    id: 'l2t2',
    level: 2,
    levelName: 'Attributes',
    title: 'Add an Attribute to Wheel',
    instruction:
      'Attributes represent physical dimensions, performance parameters, or configuration values.\n\n' +
      'Inside the **Wheel** definition, add: `attribute diameter : Real;`',
    hint: 'Place your cursor between the `{` and `}` of Wheel, then type `attribute diameter : Real;`',
    concept: 'attribute',
    conceptExplanation:
      'Each definition can have as many attributes as needed. They describe the properties of the type. ' +
      'In a real model, you would import units from the SI library (e.g., ISQ::LengthValue) for physical quantities.',
    starterCode: S3,
    targetCode: T4,
    validate: (code) => {
      if (/attribute\s+diameter\s*:\s*Real/.test(code))
        return {
          passed: true,
          message: 'Wheel now shows its diameter. Both definitions have typed attributes in their compartments.',
          severity: 'success',
        };
      if (/attribute\s+diameter/.test(code))
        return {
          passed: false,
          message: 'Add the type: `attribute diameter : Real;`',
          severity: 'hint',
        };
      if (/\bdiameter\b/.test(code))
        return {
          passed: false,
          message: 'Use the "attribute" keyword: `attribute diameter : Real;`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Inside the Wheel { } block, add: `attribute diameter : Real;`',
        severity: 'error',
      };
    },
  },

  // ── Level 3: Specialization & Composition ──────────────────────────────────
  {
    id: 'l3t1',
    level: 3,
    levelName: 'Specialization',
    title: 'Specialize a Definition',
    instruction:
      'The **`:>`** operator means "specializes" — a specialized definition defines a subset of its generalization.\n\n' +
      'A definition can have multiple generalizations, inheriting the features of all of them.\n\n' +
      'Add `part def PoweredVehicle :> Vehicle { }` — a kind of Vehicle that has a power source.',
    hint: 'Type `part def PoweredVehicle :> Vehicle { }` on a new line at the bottom.',
    concept: 'Specialization :>',
    conceptExplanation:
      'The :> symbol is equivalent to the "specializes" keyword. PoweredVehicle inherits all features of Vehicle. ' +
      'An abstract definition (marked with "abstract") is one whose instances must be members of some specialization. ' +
      'In the diagram, a solid line with a hollow triangle arrowhead points from the specialized to the general definition.',
    starterCode: S4,
    targetCode: T5,
    validate: (code) => {
      if (/part\s+def\s+PoweredVehicle\s*:>\s*Vehicle/.test(code))
        return {
          passed: true,
          message: 'A specialization arrow points from PoweredVehicle to Vehicle. It inherits all of Vehicle\'s features.',
          severity: 'success',
        };
      if (/PoweredVehicle/.test(code) && !/:>\s*Vehicle/.test(code))
        return {
          passed: false,
          message: 'Add the specialization: `part def PoweredVehicle :> Vehicle { }`',
          severity: 'hint',
        };
      if (/powered/i.test(code))
        return {
          passed: false,
          message: 'Use the exact name: `part def PoweredVehicle :> Vehicle { }`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `part def PoweredVehicle :> Vehicle { }` on a new line.',
        severity: 'error',
      };
    },
  },

  {
    id: 'l3t2',
    level: 3,
    levelName: 'Composition',
    title: 'Add Part Usages (Composition)',
    instruction:
      'A **part usage** inside a definition creates composition — "Vehicle *owns* an Engine".\n\n' +
      'The colon `:` means "defined by" — it types the usage by a definition.\n\n' +
      'Inside **Vehicle**, add both:\n' +
      '- `part eng : Engine;`\n' +
      '- `part wheel[4] : Wheel;`\n\n' +
      'The **`[4]`** is the multiplicity — exactly four wheels.',
    hint: 'Inside Vehicle { }, add two lines: `part eng : Engine;` and `part wheel[4] : Wheel;`',
    concept: '«part» usage',
    conceptExplanation:
      'A part usage is a composite feature that is the usage of a part definition. ' +
      '"part eng : Engine" means Vehicle contains exactly one Engine (default multiplicity is 1..1). ' +
      'Multiplicity [4] means four Wheel instances. ' +
      'Composition is the strongest ownership in SysML v2 — the part\'s lifecycle is tied to its owner.',
    starterCode: S5,
    targetCode: T6,
    validate: (code) => {
      const hasEngine = /part\s+eng\s*:\s*Engine/.test(code);
      const hasWheel = /part\s+wheel\s*\[?\d*\]?\s*:\s*Wheel/.test(code);
      if (hasEngine && hasWheel)
        return {
          passed: true,
          message: 'Vehicle now owns eng and wheel[4]. In the nested view, they appear inside Vehicle.',
          severity: 'success',
        };
      if (hasEngine && !hasWheel)
        return {
          passed: false,
          message: 'Engine done. Now add: `part wheel[4] : Wheel;` inside Vehicle.',
          severity: 'hint',
        };
      if (!hasEngine && hasWheel)
        return {
          passed: false,
          message: 'Wheel done. Now add: `part eng : Engine;` inside Vehicle.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Inside Vehicle { }, add: `part eng : Engine;` and `part wheel[4] : Wheel;`',
        severity: 'error',
      };
    },
  },

  // ── Level 4: Subsetting ────────────────────────────────────────────────────
  {
    id: 'l4t1',
    level: 4,
    levelName: 'Subsetting',
    title: 'Subset an Inherited Feature',
    instruction:
      '**Subsetting** (`:>` on usages) asserts that values of one feature are a subset of another feature.\n\n' +
      'PoweredVehicle inherits `wheel` from Vehicle. You can declare a more specific wheel that subsets it.\n\n' +
      'Inside **PoweredVehicle**, add: `part frontWheel :> wheel;`',
    hint: 'Inside PoweredVehicle { }, type `part frontWheel :> wheel;`',
    concept: 'Subsetting :>',
    conceptExplanation:
      'Subsetting is a kind of specialization between features. ' +
      'When :> appears on a usage (not a definition), it means "subsets" — "frontWheel is a subset of wheel". ' +
      'In every context where PoweredVehicle exists, frontWheel values are included in wheel values. ' +
      'The :> symbol is equivalent to the "subsets" keyword on usages.',
    starterCode: S6,
    targetCode: T7,
    validate: (code) => {
      if (/part\s+frontWheel\s*:>\s*wheel/.test(code))
        return {
          passed: true,
          message: 'A subsetting arrow now points from frontWheel to wheel. frontWheel is a subset of the inherited wheel feature.',
          severity: 'success',
        };
      if (/frontWheel/.test(code) && !/:>\s*wheel/.test(code))
        return {
          passed: false,
          message: 'Use subsetting syntax: `part frontWheel :> wheel;`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Inside PoweredVehicle { }, add: `part frontWheel :> wheel;`',
        severity: 'error',
      };
    },
  },

  // ── Level 5: Redefinition ──────────────────────────────────────────────────
  {
    id: 'l5t1',
    level: 5,
    levelName: 'Redefinition',
    title: 'Redefine an Inherited Feature',
    instruction:
      '**Redefinition** (`:>>`) replaces an inherited feature — changing its name and/or specializing its type.\n\n' +
      'Do two things:\n' +
      '1. Add `part def SmallEngine :> Engine { }` — a specialized Engine.\n' +
      '2. Add `part def SmallVehicle :> Vehicle { }` with `part smallEng :>> eng;` inside — this redefines the inherited `eng`.',
    hint: 'Add `part def SmallEngine :> Engine { }` then `part def SmallVehicle :> Vehicle { part smallEng :>> eng; }`',
    concept: 'Redefinition :>>',
    conceptExplanation:
      'A specialized definition can redefine a feature that would otherwise be inherited. ' +
      'The :>> symbol is equivalent to the "redefines" keyword. ' +
      '"part smallEng :>> eng" means SmallVehicle replaces the inherited eng with smallEng. ' +
      'Redefinition can change the name, specialize the type, and constrain the multiplicity of an inherited feature.',
    starterCode: S7,
    targetCode: T8,
    validate: (code) => {
      const hasSmallEngine = /part\s+def\s+SmallEngine\s*:>\s*Engine/.test(code);
      const hasRedefine = /part\s+smallEng\s*:>>\s*eng/.test(code);
      const hasSmallVehicle = /part\s+def\s+SmallVehicle\s*:>\s*Vehicle/.test(code);
      if (hasSmallEngine && hasRedefine && hasSmallVehicle)
        return {
          passed: true,
          message: 'SmallVehicle redefines the inherited eng as smallEng. A redefinition arrow connects them.',
          severity: 'success',
        };
      if (hasSmallEngine && !hasSmallVehicle)
        return {
          passed: false,
          message: 'SmallEngine done. Now add SmallVehicle: `part def SmallVehicle :> Vehicle { part smallEng :>> eng; }`',
          severity: 'hint',
        };
      if (hasSmallVehicle && !hasSmallEngine)
        return {
          passed: false,
          message: 'SmallVehicle done. Also add: `part def SmallEngine :> Engine { }`',
          severity: 'hint',
        };
      if (hasSmallVehicle && hasSmallEngine && !hasRedefine)
        return {
          passed: false,
          message: 'Both definitions exist. Inside SmallVehicle, add: `part smallEng :>> eng;`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `part def SmallEngine :> Engine { }` and `part def SmallVehicle :> Vehicle { part smallEng :>> eng; }`',
        severity: 'error',
      };
    },
  },

  // ── Level 6: Ports ─────────────────────────────────────────────────────────
  {
    id: 'l6t1',
    level: 6,
    levelName: 'Ports',
    title: 'Add a Port Definition',
    instruction:
      'A **port def** defines features that can be made available via ports — a connection contract at a system boundary.\n\n' +
      'Ports may have attribute and directed features (in, out, inout). Two ports are compatible for connection if they have matching directed features.\n\n' +
      'Add `port def FuelPort { }` to the model.',
    hint: 'Type `port def FuelPort { }` on a new line at the bottom of the file.',
    concept: '«port def»',
    conceptExplanation:
      'Port definitions replace interface blocks from SysML v1. ' +
      'They specify the "shape" of a connection point. ' +
      'A port usage on a block must reference a port definition. ' +
      'Every port definition also has an implicit conjugate definition (~FuelPort) that reverses in/out directions.',
    starterCode: S8,
    targetCode: T9,
    validate: (code) => {
      if (/port\s+def\s+FuelPort\b/.test(code))
        return {
          passed: true,
          message: 'FuelPort is now a port definition type. Next you\'ll place a port usage on Vehicle.',
          severity: 'success',
        };
      if (/FuelPort/.test(code))
        return {
          passed: false,
          message: 'Use: `port def FuelPort { }` — "port def" keywords are required.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `port def FuelPort { }` to the model.',
        severity: 'error',
      };
    },
  },

  {
    id: 'l6t2',
    level: 6,
    levelName: 'Ports',
    title: 'Add a Port Usage',
    instruction:
      'A **port usage** is a connection point through which a definition makes some of its features available.\n\n' +
      'Inside **Vehicle**, add: `port fuelPort : FuelPort;`',
    hint: 'Inside Vehicle { }, after the part usages, add: `port fuelPort : FuelPort;`',
    concept: 'port usage',
    conceptExplanation:
      'A port usage places a connection point on a block\'s boundary. It must reference a port definition. ' +
      'In the diagram, the port appears as a usage node. ' +
      'Connections between parts are established through compatible ports.',
    starterCode: S9,
    targetCode: T10,
    validate: (code) => {
      if (/port\s+fuelPort\s*:\s*FuelPort/.test(code))
        return {
          passed: true,
          message: 'Vehicle now has a fuelPort. It appears in Vehicle\'s compartment as a port usage.',
          severity: 'success',
        };
      if (/\bfuelPort\b/.test(code))
        return {
          passed: false,
          message: 'Add the type: `port fuelPort : FuelPort;`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Inside Vehicle { }, add: `port fuelPort : FuelPort;`',
        severity: 'error',
      };
    },
  },

  // ── Level 7: Items ─────────────────────────────────────────────────────────
  {
    id: 'l7t1',
    level: 7,
    levelName: 'Items',
    title: 'Add an Item Definition',
    instruction:
      'An **item def** defines a class of things that exist in space and time but are not necessarily parts of the system being modeled.\n\n' +
      'Items model what flows through connections: data, signals, energy, or physical material.\n\n' +
      'Add `item def Fuel { }` to the model.',
    hint: 'Type `item def Fuel { }` on a new line at the bottom of the file.',
    concept: '«item def»',
    conceptExplanation:
      'All parts can be treated as items, but not all items are parts. ' +
      'The design of a system determines what should be modeled as its "parts". ' +
      'An item is continuous if any portion of it in space is the same kind of thing — a portion of fuel is still fuel. ' +
      'In SysML v2, item flows are integral to connections — not separate from them.',
    starterCode: S10,
    targetCode: T11,
    validate: (code) => {
      if (/item\s+def\s+Fuel\b/.test(code))
        return {
          passed: true,
          message: 'You\'ve completed all seven levels! You built a full SysML v2 General View with specialization, subsetting, redefinition, ports, and items.',
          severity: 'success',
        };
      if (/Fuel/.test(code))
        return {
          passed: false,
          message: 'Use: `item def Fuel { }` — the "item def" keywords are required.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `item def Fuel { }` to the model.',
        severity: 'error',
      };
    },
  },
];

export const TOTAL_LEVELS = 7;
export const COMPLETED_CODE = S11;
