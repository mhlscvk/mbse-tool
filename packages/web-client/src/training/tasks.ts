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
  | 'edge-composition';

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
      'A type definition — the blueprint. Defines structure but is not an instance itself. In the diagram: sharp-cornered rectangle with keyword header.',
    minLevel: 1,
  },
  {
    label: 'attribute',
    shapeType: 'attribute',
    textualSyntax: '  attribute mass : Real;',
    explanation:
      'A typed property of a definition. Appears in the compartment below the name line as "+ name : Type".',
    minLevel: 2,
  },
  {
    label: '«part» usage',
    shapeType: 'usage',
    textualSyntax: '  part engine : Engine;',
    explanation:
      'A named instance slot owned by a definition — "Vehicle contains an Engine". Creates composition. In the diagram: rounded-corner rectangle.',
    minLevel: 3,
  },
  {
    label: 'multiplicity [n]',
    shapeType: 'usage',
    textualSyntax: '  part wheel[4] : Wheel;',
    explanation:
      '[4] means exactly four instances. [1..*] means one or more. [*] means unbounded.',
    minLevel: 3,
  },
  {
    label: 'Generalization  ─▷',
    shapeType: 'edge-generalization',
    textualSyntax: 'part def ElectricVehicle :> Vehicle { }',
    explanation:
      ':> is the specialization operator — "is a kind of". ElectricVehicle inherits all features of Vehicle. Shown as a solid line with a hollow triangle arrowhead.',
    minLevel: 3,
  },
  {
    label: '«port def»',
    shapeType: 'port',
    textualSyntax: 'port def DrivingInterface { }',
    explanation:
      'Defines a connection contract at a system boundary — specifies what kind of connection is allowed.',
    minLevel: 4,
  },
  {
    label: 'port usage  ○',
    shapeType: 'port',
    textualSyntax: '  port drivingPort : DrivingInterface;',
    explanation:
      'An actual connection point placed on a block boundary. Must reference a port definition. Shown as a small square on the block border.',
    minLevel: 4,
  },
  {
    label: '«item def»',
    shapeType: 'item',
    textualSyntax: 'item def FuelFlow { }',
    explanation:
      'Defines what flows through connections: data, signals, energy, or physical material. Items are the payloads of connections.',
    minLevel: 5,
  },
];

// ─── Cumulative code snapshots ────────────────────────────────────────────────
// Each snapshot is syntactically valid SysML v2 text.

const S0 = `\
// Vehicle System — SysML v2 General View
// A «part def» is a type definition — a blueprint, not an instance.
// Observe the Vehicle block in the diagram on the right.

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

part def ElectricVehicle :> Vehicle {
}
`;

const S6 = `\
part def Vehicle {
    part engine : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def ElectricVehicle :> Vehicle {
}
`;

const S7 = `\
part def Vehicle {
    part engine : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def ElectricVehicle :> Vehicle {
}

port def DrivingInterface {
}
`;

const S8 = `\
part def Vehicle {
    part engine : Engine;
    part wheel[4] : Wheel;
    port drivingPort : DrivingInterface;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def ElectricVehicle :> Vehicle {
}

port def DrivingInterface {
}
`;

const S9 = `\
part def Vehicle {
    part engine : Engine;
    part wheel[4] : Wheel;
    port drivingPort : DrivingInterface;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def ElectricVehicle :> Vehicle {
}

port def DrivingInterface {
}

item def FuelFlow {
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

// Add this below — :> means "is a kind of":
part def ElectricVehicle :> Vehicle {  // <-- NEW
}
`;

const T6 = `\
// Add part usages inside Vehicle:
part def Vehicle {
    part engine : Engine;    // <-- NEW (composition)
    part wheel[4] : Wheel;   // <-- NEW ([4] = multiplicity)
}

part def Engine { ... }
part def Wheel { ... }
part def ElectricVehicle :> Vehicle { }
`;

const T7 = `\
part def Vehicle {
    part engine : Engine;
    part wheel[4] : Wheel;
}

// Add this below:
port def DrivingInterface {  // <-- NEW
}
`;

const T8 = `\
// Add port usage inside Vehicle:
part def Vehicle {
    part engine : Engine;
    part wheel[4] : Wheel;
    port drivingPort : DrivingInterface;  // <-- NEW
}

port def DrivingInterface { }
`;

const T9 = `\
// Completed Vehicle System — General View

part def Vehicle {
    part engine : Engine;
    part wheel[4] : Wheel;
    port drivingPort : DrivingInterface;
}

part def Engine { attribute mass : Real; }
part def Wheel { attribute diameter : Real; }
part def ElectricVehicle :> Vehicle { }
port def DrivingInterface { }

// Add this below:
item def FuelFlow { }   // <-- NEW
`;

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const TRAINING_TASKS: TrainingTask[] = [
  // ── Level 1: Part Definitions ──────────────────────────────────────────────
  {
    id: 'l1t1',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Add a Part Definition',
    instruction:
      'The diagram shows a **Vehicle** block. A **«part def»** is a *type* — a blueprint.\n\n' +
      'Add a second part definition called **Engine** to the model.',
    hint: 'Type `part def Engine { }` on a new line below the Vehicle definition.',
    concept: '«part def»',
    conceptExplanation:
      'A Part Definition declares a reusable type. In SysML v2, types (definitions) and instances (usages) are always kept separate. ' +
      'You define the blueprint once, then use it many times.',
    starterCode: S0,
    targetCode: T1,
    validate: (code) => {
      if (/part\s+def\s+Engine\b/.test(code))
        return {
          passed: true,
          message: 'Engine is a part definition — a type blueprint. It appears as a new block in the diagram.',
          severity: 'success',
        };
      if (/\bengine\b/i.test(code))
        return {
          passed: false,
          message: 'Use both keywords: `part def Engine { }` — "part def" is required.',
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
      'A vehicle also needs wheels. Add a part definition called **Wheel** to the model.',
    hint: 'Type `part def Wheel { }` on a new line after Engine.',
    concept: '«part def»',
    conceptExplanation:
      'Each concept in your system gets its own Part Definition. They\'re independent at this stage — ' +
      'relationships between them come in later levels.',
    starterCode: S1,
    targetCode: T2,
    validate: (code) => {
      if (/part\s+def\s+Wheel\b/.test(code))
        return {
          passed: true,
          message: 'You now have three Part Definitions. The diagram shows each as a separate block.',
          severity: 'success',
        };
      if (/\bwheel\b/i.test(code))
        return {
          passed: false,
          message: 'Use both keywords: `part def Wheel { }` — the "part def" prefix is required.',
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
      'An **attribute** is a typed property. It appears in the compartment below the name.\n\n' +
      'Inside the **Engine** definition, add: `attribute mass : Real;`',
    hint: 'Place your cursor between the `{` and `}` of Engine, then type `attribute mass : Real;`',
    concept: 'attribute',
    conceptExplanation:
      '"attribute mass : Real" means Engine has a property called mass of type Real. ' +
      'The colon separates the name from the type. Built-in types include Real, Integer, Boolean, and String.',
    starterCode: S2,
    targetCode: T3,
    validate: (code) => {
      if (/attribute\s+mass\s*:\s*Real/.test(code))
        return {
          passed: true,
          message: 'Engine\'s compartment now shows "+ mass : Real". Attributes appear below the name line.',
          severity: 'success',
        };
      if (/attribute\s+mass/.test(code))
        return {
          passed: false,
          message: 'Add the type: `attribute mass : Real;` — the ": Real" part is required.',
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
      'Inside the **Wheel** definition, add: `attribute diameter : Real;`',
    hint: 'Place your cursor between the `{` and `}` of Wheel, then type `attribute diameter : Real;`',
    concept: 'attribute',
    conceptExplanation:
      'Each definition can have as many attributes as needed. They represent measurable or observable ' +
      'properties — physical dimensions, performance parameters, or configuration values.',
    starterCode: S3,
    targetCode: T4,
    validate: (code) => {
      if (/attribute\s+diameter\s*:\s*Real/.test(code))
        return {
          passed: true,
          message: 'Wheel now shows its diameter. Both Engine and Wheel have typed attributes in their compartments.',
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

  // ── Level 3: Generalization & Composition ──────────────────────────────────
  {
    id: 'l3t1',
    level: 3,
    levelName: 'Generalization',
    title: 'Specialize a Definition',
    instruction:
      'A **generalization** (─▷) means "is a kind of". The operator is **`:>`**.\n\n' +
      'Add `part def ElectricVehicle :> Vehicle { }` — a vehicle that specializes Vehicle.',
    hint: 'Type `part def ElectricVehicle :> Vehicle { }` on a new line at the bottom.',
    concept: 'Generalization ─▷',
    conceptExplanation:
      ':> is SysML v2\'s specialization operator. ElectricVehicle inherits all features of Vehicle. ' +
      'In the diagram, a hollow triangle arrowhead points from ElectricVehicle to Vehicle.',
    starterCode: S4,
    targetCode: T5,
    validate: (code) => {
      if (/part\s+def\s+ElectricVehicle\s*:>\s*Vehicle/.test(code))
        return {
          passed: true,
          message: 'A generalization arrow now points from ElectricVehicle to Vehicle. It inherits all of Vehicle\'s features.',
          severity: 'success',
        };
      if (/ElectricVehicle/.test(code) && !/:>\s*Vehicle/.test(code))
        return {
          passed: false,
          message: 'Add the specialization: `part def ElectricVehicle :> Vehicle { }`',
          severity: 'hint',
        };
      if (/electric/i.test(code))
        return {
          passed: false,
          message: 'Exact name: `part def ElectricVehicle :> Vehicle { }`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `part def ElectricVehicle :> Vehicle { }` on a new line.',
        severity: 'error',
      };
    },
  },

  {
    id: 'l3t2',
    level: 3,
    levelName: 'Composition',
    title: 'Add Part Usages',
    instruction:
      'A **part usage** inside a definition creates composition — "Vehicle owns an Engine".\n\n' +
      'Inside **Vehicle**, add both:\n' +
      '- `part engine : Engine;`\n' +
      '- `part wheel[4] : Wheel;`\n\n' +
      'The **`[4]`** is the multiplicity — four wheels.',
    hint: 'Inside Vehicle { }, add two lines: `part engine : Engine;` and `part wheel[4] : Wheel;`',
    concept: '«part» usage',
    conceptExplanation:
      'A part usage is an owned instance slot. "part engine : Engine" means Vehicle contains exactly one Engine. ' +
      'Multiplicity [4] means four Wheel instances. Composition is the strongest ownership relationship in SysML v2.',
    starterCode: S5,
    targetCode: T6,
    validate: (code) => {
      const hasEngine = /part\s+engine\s*:\s*Engine/.test(code);
      const hasWheel = /part\s+wheel\s*\[?\d*\]?\s*:\s*Wheel/.test(code);
      if (hasEngine && hasWheel)
        return {
          passed: true,
          message: 'Vehicle now shows composition: engine and wheel[4] appear in its compartment.',
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
          message: 'Wheel done. Now add: `part engine : Engine;` inside Vehicle.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Inside Vehicle { }, add: `part engine : Engine;` and `part wheel[4] : Wheel;`',
        severity: 'error',
      };
    },
  },

  // ── Level 4: Ports ─────────────────────────────────────────────────────────
  {
    id: 'l4t1',
    level: 4,
    levelName: 'Ports',
    title: 'Add a Port Definition',
    instruction:
      'A **port def** defines a connection contract — what kind of connection is allowed at a boundary.\n\n' +
      'Add `port def DrivingInterface { }` to the model.',
    hint: 'Type `port def DrivingInterface { }` on a new line at the bottom of the file.',
    concept: '«port def»',
    conceptExplanation:
      'Port definitions are interface contracts. They specify the "shape" of a connection point. ' +
      'A port usage on a block must reference a port definition — it can\'t connect arbitrarily.',
    starterCode: S6,
    targetCode: T7,
    validate: (code) => {
      if (/port\s+def\s+DrivingInterface\b/.test(code))
        return {
          passed: true,
          message: 'DrivingInterface is now a port definition type. Next you\'ll place a port usage on Vehicle.',
          severity: 'success',
        };
      if (/DrivingInterface/.test(code))
        return {
          passed: false,
          message: 'Use: `port def DrivingInterface { }` — "port def" keywords are required.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `port def DrivingInterface { }` to the model.',
        severity: 'error',
      };
    },
  },

  {
    id: 'l4t2',
    level: 4,
    levelName: 'Ports',
    title: 'Add a Port Usage',
    instruction:
      'Now place a **port usage** on Vehicle — an actual connection point that uses the DrivingInterface type.\n\n' +
      'Inside **Vehicle**, add: `port drivingPort : DrivingInterface;`',
    hint: 'Inside Vehicle { }, after the part usages, add: `port drivingPort : DrivingInterface;`',
    concept: 'port usage ○',
    conceptExplanation:
      'A port usage places a connection point on a block\'s boundary. It must reference a port definition. ' +
      'In diagrams, ports appear as small squares on the block border — the connection attachment point.',
    starterCode: S7,
    targetCode: T8,
    validate: (code) => {
      if (/port\s+drivingPort\s*:\s*DrivingInterface/.test(code))
        return {
          passed: true,
          message: 'Vehicle now has a port. "port drivingPort : DrivingInterface" appears in its compartment.',
          severity: 'success',
        };
      if (/\bdrivingPort\b/.test(code))
        return {
          passed: false,
          message: 'Add the type: `port drivingPort : DrivingInterface;`',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Inside Vehicle { }, add: `port drivingPort : DrivingInterface;`',
        severity: 'error',
      };
    },
  },

  // ── Level 5: Items ─────────────────────────────────────────────────────────
  {
    id: 'l5t1',
    level: 5,
    levelName: 'Items',
    title: 'Add an Item Definition',
    instruction:
      'An **item def** defines what flows through connections — data, signals, or physical material.\n\n' +
      'Add `item def FuelFlow { }` to the model.',
    hint: 'Type `item def FuelFlow { }` on a new line at the bottom of the file.',
    concept: '«item def»',
    conceptExplanation:
      'Items define the payloads of flows. They can represent electrical signals, data packets, ' +
      'mechanical forces, or fluids. In SysML v2, item flows are integral to connections — not separate from them.',
    starterCode: S8,
    targetCode: T9,
    validate: (code) => {
      if (/item\s+def\s+FuelFlow\b/.test(code))
        return {
          passed: true,
          message: 'You\'ve completed all five levels! You built a full SysML v2 General View from scratch.',
          severity: 'success',
        };
      if (/FuelFlow/.test(code))
        return {
          passed: false,
          message: 'Use: `item def FuelFlow { }` — the "item def" keywords are required.',
          severity: 'hint',
        };
      return {
        passed: false,
        message: 'Add `item def FuelFlow { }` to the model.',
        severity: 'error',
      };
    },
  },
];

export const TOTAL_LEVELS = 5;
export const COMPLETED_CODE = S9;
