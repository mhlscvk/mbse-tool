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
  instruction: string;
  hint: string;
  concept: string;
  conceptExplanation: string;
  starterCode: string;
  targetCode: string;
  validate: (code: string) => ValidationResult;
}

export type LegendShapeType =
  | 'definition'
  | 'usage'
  | 'attribute'
  | 'port'
  | 'item'
  | 'enum'
  | 'action'
  | 'state'
  | 'requirement'
  | 'constraint'
  | 'connection'
  | 'package'
  | 'usecase'
  | 'view'
  | 'edge-generalization'
  | 'edge-composition'
  | 'edge-subsetting'
  | 'edge-redefinition'
  | 'edge-succession'
  | 'edge-satisfy';

export interface LegendItem {
  label: string;
  shapeType: LegendShapeType;
  textualSyntax: string;
  explanation: string;
  minLevel: number;
}

// ─── Validation helpers ─────────────────────────────────────────────────────

type VFn = (code: string) => ValidationResult;

function ok(message: string): ValidationResult {
  return { passed: true, message, severity: 'success' };
}
function hint(message: string): ValidationResult {
  return { passed: false, message, severity: 'hint' };
}
function err(message: string): ValidationResult {
  return { passed: false, message, severity: 'error' };
}

/** Validates `keyword name` (e.g. `part def Vehicle`) */
function vDef(keyword: string, name: string, success: string, error: string): VFn {
  return (code) => {
    if (new RegExp(`${keyword}\\s+${name}\\b`).test(code)) return ok(success);
    if (new RegExp(name, 'i').test(code))
      return hint(`Use the full syntax: \`${keyword} ${name} { }\``);
    return err(error);
  };
}

/** Validates `keyword name :> parent` */
function vSpec(keyword: string, name: string, parent: string, success: string, error: string): VFn {
  return (code) => {
    if (new RegExp(`${keyword}\\s+${name}\\s*:>\\s*${parent}`).test(code)) return ok(success);
    if (new RegExp(name).test(code))
      return hint(`Add specialization: \`${keyword} ${name} :> ${parent} { }\``);
    return err(error);
  };
}

/** Validates `attribute name : type` inside parent */
function vAttr(name: string, type: string, parent: string, success: string): VFn {
  return (code) => {
    if (new RegExp(`attribute\\s+${name}\\s*:\\s*${type}`).test(code)) return ok(success);
    if (new RegExp(`\\b${name}\\b`).test(code))
      return hint(`Add the type: \`attribute ${name} : ${type};\``);
    return err(`Inside ${parent} { }, add: \`attribute ${name} : ${type};\``);
  };
}

/** Validates `keyword name[mult] : Type` inside parent */
function vUsage(keyword: string, name: string, type: string, mult: string, parent: string, success: string): VFn {
  const multPat = mult ? `\\s*\\[${mult}\\]` : '';
  const multStr = mult ? `[${mult}]` : '';
  return (code) => {
    if (new RegExp(`${keyword}\\s+${name}${multPat}\\s*:\\s*${type}`).test(code)) return ok(success);
    if (new RegExp(`\\b${name}\\b`).test(code))
      return hint(`Use: \`${keyword} ${name}${multStr} : ${type};\``);
    return err(`Inside ${parent} { }, add: \`${keyword} ${name}${multStr} : ${type};\``);
  };
}

/** Validates `part name :> parent` (subsetting) */
function vSubset(name: string, parent: string, container: string, success: string): VFn {
  return (code) => {
    if (new RegExp(`part\\s+${name}\\s*:>\\s*${parent}`).test(code)) return ok(success);
    if (new RegExp(`\\b${name}\\b`).test(code))
      return hint(`Use subsetting: \`part ${name} :> ${parent};\``);
    return err(`Inside ${container} { }, add: \`part ${name} :> ${parent};\``);
  };
}

/** Validates `part name :>> parent` (redefinition) */
function vRedef(name: string, parent: string, container: string, success: string): VFn {
  return (code) => {
    if (new RegExp(`part\\s+${name}\\s*:>>\\s*${parent}`).test(code)) return ok(success);
    if (new RegExp(`\\b${name}\\b`).test(code))
      return hint(`Use redefinition: \`part ${name} :>> ${parent};\``);
    return err(`Inside ${container} { }, add: \`part ${name} :>> ${parent};\``);
  };
}

/** Validates a regex match with optional hint pattern */
function vMatch(pattern: RegExp, success: string, hintPat: RegExp | null, hintMsg: string, error: string): VFn {
  return (code) => {
    if (pattern.test(code)) return ok(success);
    if (hintPat && hintPat.test(code)) return hint(hintMsg);
    return err(error);
  };
}

/** Validates multiple conditions all passing */
function vAll(checks: Array<{ pat: RegExp; hint: string }>, success: string, error: string): VFn {
  return (code) => {
    const failed = checks.find((c) => !c.pat.test(code));
    if (!failed) return ok(success);
    const passed = checks.filter((c) => c.pat.test(code));
    if (passed.length > 0) return hint(failed.hint);
    return err(error);
  };
}

// ─── Legend items (unlocked progressively by level) ──────────────────────────

export const LEGEND_ITEMS: LegendItem[] = [
  {
    label: '«part def»',
    shapeType: 'definition',
    textualSyntax: 'part def Vehicle { }',
    explanation:
      'A part definition defines a class of systems or parts of systems. ' +
      'It is a blueprint — a type, not an instance. Sharp-cornered rectangle in the diagram.',
    minLevel: 1,
  },
  {
    label: 'attribute',
    shapeType: 'attribute',
    textualSyntax: '  attribute mass : Real;',
    explanation:
      'A typed property. The colon separates name from type. ' +
      'Built-in types: Real, Integer, Boolean, String.',
    minLevel: 2,
  },
  {
    label: 'Specialization  :>',
    shapeType: 'edge-generalization',
    textualSyntax: 'part def SportsCar :> Vehicle { }',
    explanation:
      ':> means "specializes". The specialized definition inherits all features ' +
      'of the general definition. Shown as a line with hollow triangle arrowhead.',
    minLevel: 3,
  },
  {
    label: '«part» usage',
    shapeType: 'usage',
    textualSyntax: '  part eng : Engine;',
    explanation:
      'A part usage is a composite feature — "Vehicle owns an Engine". ' +
      'Creates a composition relationship. Rounded-corner rectangle.',
    minLevel: 4,
  },
  {
    label: 'multiplicity [n]',
    shapeType: 'usage',
    textualSyntax: '  part wheel[4] : Wheel;',
    explanation:
      '[4] means exactly four instances. [1..*] means one or more. [*] unbounded. Default is 1..1.',
    minLevel: 4,
  },
  {
    label: 'Subsetting  :>',
    shapeType: 'edge-subsetting',
    textualSyntax: '  part frontWheel :> wheel;',
    explanation:
      ':> on usages means "subsets". Values of the subsetting feature are a subset of the subsetted feature.',
    minLevel: 5,
  },
  {
    label: 'Redefinition  :>>',
    shapeType: 'edge-redefinition',
    textualSyntax: '  part smallEng :>> eng;',
    explanation:
      ':>> replaces an inherited feature with a new name and/or specialized type.',
    minLevel: 6,
  },
  {
    label: '«port def»',
    shapeType: 'port',
    textualSyntax: 'port def FuelPort { }',
    explanation:
      'A port definition defines features available at a system boundary. ' +
      'Ports may have directed features (in, out, inout).',
    minLevel: 7,
  },
  {
    label: 'port usage',
    shapeType: 'port',
    textualSyntax: '  port fuelPort : FuelPort;',
    explanation:
      'A port usage places a connection point on a block\'s boundary.',
    minLevel: 7,
  },
  {
    label: 'in / out / inout',
    shapeType: 'attribute',
    textualSyntax: '  in attribute fuelIn : Fuel;',
    explanation:
      'Directed features specify flow direction through ports. ' +
      '"in" receives, "out" sends, "inout" does both.',
    minLevel: 7,
  },
  {
    label: '«item def»',
    shapeType: 'item',
    textualSyntax: 'item def Fuel { }',
    explanation:
      'An item defines things that flow through connections: data, signals, or material.',
    minLevel: 8,
  },
  {
    label: '«connection def»',
    shapeType: 'connection',
    textualSyntax: 'connection def FuelLine { }',
    explanation:
      'A connection definition specifies a type of connection between parts via their ports.',
    minLevel: 8,
  },
  {
    label: '«enum def»',
    shapeType: 'enum',
    textualSyntax: 'enum def Color {\n  Red; Green; Blue;\n}',
    explanation:
      'An enumeration defines a fixed set of named values. Each value is a member of the enum type.',
    minLevel: 9,
  },
  {
    label: '«action def»',
    shapeType: 'action',
    textualSyntax: 'action def Launch { }',
    explanation:
      'An action definition defines a behavior or step. Actions can have in/out parameters, ' +
      'nested action usages, and successions.',
    minLevel: 10,
  },
  {
    label: 'succession (then)',
    shapeType: 'edge-succession',
    textualSyntax: '  first start then launch;',
    explanation:
      '"first ... then ..." defines execution order between action usages. ' +
      'A succession is a directed temporal relationship.',
    minLevel: 10,
  },
  {
    label: 'fork / join',
    shapeType: 'action',
    textualSyntax: '  fork; join;',
    explanation:
      'Fork splits flow into concurrent branches. Join synchronizes concurrent branches back together.',
    minLevel: 10,
  },
  {
    label: 'decide / merge',
    shapeType: 'action',
    textualSyntax: '  decide; merge;',
    explanation:
      'Decide selects one of multiple branches based on guards. Merge brings alternative branches together.',
    minLevel: 10,
  },
  {
    label: '«state def»',
    shapeType: 'state',
    textualSyntax: 'state def VehicleStates { }',
    explanation:
      'A state definition defines a set of states and transitions that model the lifecycle of a system.',
    minLevel: 11,
  },
  {
    label: 'transition (then)',
    shapeType: 'edge-succession',
    textualSyntax: '  transition first idle then running;',
    explanation:
      'A transition defines a state change. "first S1 then S2" moves from state S1 to state S2.',
    minLevel: 11,
  },
  {
    label: '«requirement def»',
    shapeType: 'requirement',
    textualSyntax: 'requirement def MassReq { }',
    explanation:
      'A requirement definition captures a condition that a system must satisfy. ' +
      'May include doc text and a subject.',
    minLevel: 12,
  },
  {
    label: 'satisfy / verify',
    shapeType: 'edge-satisfy',
    textualSyntax: '  satisfy MassReq by Vehicle;',
    explanation:
      '"satisfy" asserts a design element meets a requirement. ' +
      '"verify" asserts a test verifies a requirement.',
    minLevel: 12,
  },
  {
    label: '«constraint def»',
    shapeType: 'constraint',
    textualSyntax: 'constraint def MassLimit { }',
    explanation:
      'A constraint definition defines a boolean condition (predicate) that must hold true.',
    minLevel: 13,
  },
  {
    label: '«calc def»',
    shapeType: 'constraint',
    textualSyntax: 'calc def TotalMass { }',
    explanation:
      'A calculation definition defines a computation with typed in/out parameters.',
    minLevel: 13,
  },
  {
    label: 'package',
    shapeType: 'package',
    textualSyntax: 'package VehicleDomain { }',
    explanation:
      'A package is a namespace that groups related definitions. ' +
      'Packages can contain other packages, definitions, and imports.',
    minLevel: 14,
  },
  {
    label: 'import',
    shapeType: 'package',
    textualSyntax: '  import VehicleDomain::*;',
    explanation:
      'Import makes elements from another package visible. ' +
      '::* imports all members. ::Name imports a specific element.',
    minLevel: 14,
  },
  {
    label: '«use case def»',
    shapeType: 'usecase',
    textualSyntax: 'use case def DriveToWork { }',
    explanation:
      'A use case definition describes a usage scenario of the system by an actor.',
    minLevel: 15,
  },
  {
    label: '«view def» / «viewpoint def»',
    shapeType: 'view',
    textualSyntax: 'viewpoint def EngineerView { }',
    explanation:
      'A viewpoint defines stakeholder concerns. A view renders model content for a viewpoint.',
    minLevel: 15,
  },
];

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const TRAINING_TASKS: TrainingTask[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 1: Part Definitions (6 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l1t1',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Create Your First Part Definition',
    instruction:
      'A **«part def»** defines a class of systems or parts of systems.\n\n' +
      'It is a type — a blueprint, not an instance. You define the blueprint once, then create usages of it many times.\n\n' +
      'The editor already has a **Vehicle** definition. Add a second one called **Engine**.',
    hint: 'Type `part def Engine { }` on a new line below the Vehicle definition.',
    concept: '«part def»',
    conceptExplanation:
      'A Part Definition declares a reusable type. In SysML v2, types (definitions) and instances (usages) ' +
      'are always kept separate — this is the definition/usage pattern. ' +
      'Definitions have sharp-cornered rectangles in the diagram.',
    starterCode: `\
// Vehicle System — SysML v2 Training
// A «part def» defines a class of systems.

part def Vehicle {
}
`,
    targetCode: `\
part def Vehicle {
}

// Add this below:
part def Engine {   // <-- NEW
}
`,
    validate: vDef('part\\s+def', 'Engine',
      'Engine is now a part definition — a type blueprint. It appears as a new block in the diagram.',
      'Add `part def Engine { }` on a new line.'),
  },

  {
    id: 'l1t2',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Add a Wheel Definition',
    instruction:
      'A vehicle needs wheels. Each concept in your system gets its own Part Definition.\n\n' +
      'Add a part definition called **Wheel**.',
    hint: 'Type `part def Wheel { }` on a new line after Engine.',
    concept: '«part def»',
    conceptExplanation:
      'Part definitions are independent at this stage. Relationships between them — composition, ' +
      'specialization, and connections — come in later levels.',
    starterCode: `\
part def Vehicle {
}

part def Engine {
}
`,
    targetCode: `\
part def Vehicle {
}

part def Engine {
}

part def Wheel {    // <-- NEW
}
`,
    validate: vDef('part\\s+def', 'Wheel',
      'Three Part Definitions — each appears as an independent block in the diagram.',
      'Add `part def Wheel { }` on a new line.'),
  },

  {
    id: 'l1t3',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Add a Chassis Definition',
    instruction:
      'The chassis is the structural frame of the vehicle.\n\n' +
      'Add a part definition called **Chassis**.',
    hint: 'Type `part def Chassis { }` on a new line.',
    concept: '«part def»',
    conceptExplanation:
      'Every major component in a system should be its own definition. ' +
      'This enables reuse — the same Chassis type can appear in many vehicle designs.',
    starterCode: `\
part def Vehicle {
}

part def Engine {
}

part def Wheel {
}
`,
    targetCode: `\
// ...existing definitions...

part def Chassis {  // <-- NEW
}
`,
    validate: vDef('part\\s+def', 'Chassis',
      'Chassis added. Four blocks now visible in the diagram.',
      'Add `part def Chassis { }` on a new line.'),
  },

  {
    id: 'l1t4',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Add a Transmission Definition',
    instruction:
      'The transmission transfers power from the engine to the wheels.\n\n' +
      'Add a part definition called **Transmission**.',
    hint: 'Type `part def Transmission { }` on a new line.',
    concept: '«part def»',
    conceptExplanation:
      'Naming conventions in SysML v2: definition names are PascalCase (UpperCamelCase). ' +
      'Usage names (instances) are lowerCamelCase. This convention is consistent across the language.',
    starterCode: `\
part def Vehicle {
}

part def Engine {
}

part def Wheel {
}

part def Chassis {
}
`,
    targetCode: `\
// ...existing definitions...

part def Transmission {  // <-- NEW
}
`,
    validate: vDef('part\\s+def', 'Transmission',
      'Transmission added. Five component types defined.',
      'Add `part def Transmission { }` on a new line.'),
  },

  {
    id: 'l1t5',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Add a BrakeSystem Definition',
    instruction:
      'Every vehicle needs brakes for safety.\n\n' +
      'Add a part definition called **BrakeSystem**.',
    hint: 'Type `part def BrakeSystem { }` on a new line.',
    concept: '«part def»',
    conceptExplanation:
      'Multi-word definition names use PascalCase without spaces or underscores. ' +
      'BrakeSystem, not Brake_System or brake system.',
    starterCode: `\
part def Vehicle {
}

part def Engine {
}

part def Wheel {
}

part def Chassis {
}

part def Transmission {
}
`,
    targetCode: `\
// ...existing definitions...

part def BrakeSystem {  // <-- NEW
}
`,
    validate: vDef('part\\s+def', 'BrakeSystem',
      'Six part definitions! Your vehicle system type library is taking shape.',
      'Add `part def BrakeSystem { }` on a new line.'),
  },

  {
    id: 'l1t6',
    level: 1,
    levelName: 'Part Definitions',
    title: 'Add a Sensor Definition',
    instruction:
      'Modern vehicles have many sensors. Add one more part definition.\n\n' +
      'Add a part definition called **Sensor**.',
    hint: 'Type `part def Sensor { }` on a new line.',
    concept: '«part def»',
    conceptExplanation:
      'You now have seven independent type blueprints. In a real project, you might have hundreds. ' +
      'SysML v2 packages (covered later) help organize them into namespaces.',
    starterCode: `\
part def Vehicle {
}

part def Engine {
}

part def Wheel {
}

part def Chassis {
}

part def Transmission {
}

part def BrakeSystem {
}
`,
    targetCode: `\
// ...existing definitions...

part def Sensor {  // <-- NEW
}
`,
    validate: vDef('part\\s+def', 'Sensor',
      'Seven part definitions complete! Next: add properties to describe these types.',
      'Add `part def Sensor { }` on a new line.'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 2: Attributes (7 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l2t1',
    level: 2,
    levelName: 'Attributes',
    title: 'Add Mass to Engine',
    instruction:
      'An **attribute** is a typed property that describes a characteristic.\n\n' +
      'The colon `:` separates the name from its type — the "defined by" relationship.\n\n' +
      'Inside **Engine**, add: `attribute mass : Real;`',
    hint: 'Place your cursor between the `{` and `}` of Engine, then type `attribute mass : Real;`',
    concept: 'attribute',
    conceptExplanation:
      '"attribute mass : Real" means Engine has a property called mass of type Real. ' +
      'Built-in scalar types include Real, Integer, Boolean, and String (from the ScalarValues library).',
    starterCode: `\
part def Vehicle {
}

part def Engine {
}

part def Wheel {
}

part def Chassis {
}

part def Transmission {
}

part def BrakeSystem {
}

part def Sensor {
}
`,
    targetCode: `\
part def Engine {
    attribute mass : Real;  // <-- NEW
}
`,
    validate: vAttr('mass', 'Real', 'Engine',
      'Engine now shows "mass : Real" in its compartment.'),
  },

  {
    id: 'l2t2',
    level: 2,
    levelName: 'Attributes',
    title: 'Add Diameter to Wheel',
    instruction:
      'Attributes represent physical dimensions, performance parameters, or configuration values.\n\n' +
      'Inside **Wheel**, add: `attribute diameter : Real;`',
    hint: 'Inside Wheel { }, type `attribute diameter : Real;`',
    concept: 'attribute',
    conceptExplanation:
      'In a real model you would import units from the SI library (e.g., ISQ::LengthValue). ' +
      'For training, we use the basic Real type.',
    starterCode: `\
part def Vehicle {
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
}

part def Chassis {
}

part def Transmission {
}

part def BrakeSystem {
}

part def Sensor {
}
`,
    targetCode: `\
part def Wheel {
    attribute diameter : Real;  // <-- NEW
}
`,
    validate: vAttr('diameter', 'Real', 'Wheel',
      'Wheel now shows its diameter attribute.'),
  },

  {
    id: 'l2t3',
    level: 2,
    levelName: 'Attributes',
    title: 'Add Max Speed to Vehicle',
    instruction:
      'The Vehicle itself can have attributes too.\n\n' +
      'Inside **Vehicle**, add: `attribute maxSpeed : Real;`',
    hint: 'Inside Vehicle { }, type `attribute maxSpeed : Real;`',
    concept: 'attribute',
    conceptExplanation:
      'Attribute names use lowerCamelCase — maxSpeed, not MaxSpeed or max_speed. ' +
      'This follows SysML v2 naming conventions.',
    starterCode: `\
part def Vehicle {
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
}

part def Transmission {
}

part def BrakeSystem {
}

part def Sensor {
}
`,
    targetCode: `\
part def Vehicle {
    attribute maxSpeed : Real;  // <-- NEW
}
`,
    validate: vAttr('maxSpeed', 'Real', 'Vehicle',
      'Vehicle now has a maxSpeed property.'),
  },

  {
    id: 'l2t4',
    level: 2,
    levelName: 'Attributes',
    title: 'Add Gear Count with Integer Type',
    instruction:
      'Not all attributes are Real numbers. **Integer** is used for whole-number quantities.\n\n' +
      'Inside **Transmission**, add: `attribute gearCount : Integer;`',
    hint: 'Inside Transmission { }, type `attribute gearCount : Integer;`',
    concept: 'attribute types',
    conceptExplanation:
      'SysML v2 scalar types: Real (floating point), Integer (whole numbers), ' +
      'Boolean (true/false), String (text). Types come from the ScalarValues standard library.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
}

part def Transmission {
}

part def BrakeSystem {
}

part def Sensor {
}
`,
    targetCode: `\
part def Transmission {
    attribute gearCount : Integer;  // <-- NEW
}
`,
    validate: vAttr('gearCount', 'Integer', 'Transmission',
      'gearCount uses Integer type — perfect for whole-number values.'),
  },

  {
    id: 'l2t5',
    level: 2,
    levelName: 'Attributes',
    title: 'Add a Boolean Attribute',
    instruction:
      '**Boolean** attributes represent true/false flags.\n\n' +
      'Inside **BrakeSystem**, add: `attribute isABS : Boolean;`',
    hint: 'Inside BrakeSystem { }, type `attribute isABS : Boolean;`',
    concept: 'Boolean type',
    conceptExplanation:
      'Boolean attributes are useful for system configuration flags. ' +
      'isABS indicates whether the brake system has Anti-lock Braking System capability.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
}

part def Sensor {
}
`,
    targetCode: `\
part def BrakeSystem {
    attribute isABS : Boolean;  // <-- NEW
}
`,
    validate: vAttr('isABS', 'Boolean', 'BrakeSystem',
      'BrakeSystem has a Boolean flag for ABS capability.'),
  },

  {
    id: 'l2t6',
    level: 2,
    levelName: 'Attributes',
    title: 'Add a String Attribute',
    instruction:
      '**String** attributes hold text values.\n\n' +
      'Inside **Chassis**, add: `attribute material : String;`',
    hint: 'Inside Chassis { }, type `attribute material : String;`',
    concept: 'String type',
    conceptExplanation:
      'String attributes store textual data — names, descriptions, identifiers, or material types. ' +
      'For constrained text values, enumerations (covered later) are preferred.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def Sensor {
}
`,
    targetCode: `\
part def Chassis {
    attribute material : String;  // <-- NEW
}
`,
    validate: vAttr('material', 'String', 'Chassis',
      'Chassis now tracks its material. You\'ve used all four scalar types!'),
  },

  {
    id: 'l2t7',
    level: 2,
    levelName: 'Attributes',
    title: 'Add Multiple Attributes',
    instruction:
      'A definition can have many attributes. Add **two** attributes to **Engine**:\n\n' +
      '- `attribute horsepower : Real;`\n' +
      '- `attribute cylinders : Integer;`',
    hint: 'Inside Engine { }, after the mass attribute, add both lines.',
    concept: 'multiple attributes',
    conceptExplanation:
      'Definitions can have as many attributes as needed. Each describes a different property of the type. ' +
      'Together they form the "attribute compartment" in the diagram notation.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def Sensor {
}
`,
    targetCode: `\
part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;   // <-- NEW
    attribute cylinders : Integer; // <-- NEW
}
`,
    validate: vAll([
      { pat: /attribute\s+horsepower\s*:\s*Real/, hint: 'Also add: `attribute cylinders : Integer;`' },
      { pat: /attribute\s+cylinders\s*:\s*Integer/, hint: 'Also add: `attribute horsepower : Real;`' },
    ],
    'Engine now has mass, horsepower, and cylinders. Attributes fully covered!',
    'Inside Engine { }, add: `attribute horsepower : Real;` and `attribute cylinders : Integer;`'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 3: Specialization (7 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l3t1',
    level: 3,
    levelName: 'Specialization',
    title: 'Specialize Vehicle',
    instruction:
      'The **`:>`** operator means "specializes" — a more specific kind of something.\n\n' +
      'A specialized definition inherits all features of its general definition.\n\n' +
      'Add `part def PoweredVehicle :> Vehicle { }` — a vehicle with a power source.',
    hint: 'Type `part def PoweredVehicle :> Vehicle { }` on a new line.',
    concept: 'Specialization :>',
    conceptExplanation:
      ':> is equivalent to the "specializes" keyword. PoweredVehicle inherits maxSpeed from Vehicle. ' +
      'In the diagram, a solid line with a hollow triangle arrowhead points from specialized to general.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    attribute cylinders : Integer;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def Sensor {
}
`,
    targetCode: `\
// :> means "specializes":
part def PoweredVehicle :> Vehicle {  // <-- NEW
}
`,
    validate: vSpec('part\\s+def', 'PoweredVehicle', 'Vehicle',
      'A specialization arrow points from PoweredVehicle to Vehicle. It inherits maxSpeed.',
      'Add `part def PoweredVehicle :> Vehicle { }` on a new line.'),
  },

  {
    id: 'l3t2',
    level: 3,
    levelName: 'Specialization',
    title: 'Specialize Engine — Electric',
    instruction:
      'Engines come in different types. Create an electric variant.\n\n' +
      'Add `part def ElectricEngine :> Engine { }`',
    hint: 'Type `part def ElectricEngine :> Engine { }` on a new line.',
    concept: 'Specialization :>',
    conceptExplanation:
      'ElectricEngine inherits mass, horsepower, and cylinders from Engine. ' +
      'You can add new attributes or override inherited ones in the specialized definition.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    attribute cylinders : Integer;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def Sensor {
}

part def PoweredVehicle :> Vehicle {
}
`,
    targetCode: `\
part def ElectricEngine :> Engine {  // <-- NEW
}
`,
    validate: vSpec('part\\s+def', 'ElectricEngine', 'Engine',
      'ElectricEngine specializes Engine — it inherits all Engine attributes.',
      'Add `part def ElectricEngine :> Engine { }` on a new line.'),
  },

  {
    id: 'l3t3',
    level: 3,
    levelName: 'Specialization',
    title: 'Specialize Engine — Combustion',
    instruction:
      'Create another Engine specialization for combustion engines.\n\n' +
      'Add `part def CombustionEngine :> Engine { }`',
    hint: 'Type `part def CombustionEngine :> Engine { }` on a new line.',
    concept: 'Specialization :>',
    conceptExplanation:
      'Multiple definitions can specialize the same general definition. ' +
      'Both ElectricEngine and CombustionEngine are kinds of Engine.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    attribute cylinders : Integer;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def Sensor {
}

part def PoweredVehicle :> Vehicle {
}

part def ElectricEngine :> Engine {
}
`,
    targetCode: `\
part def CombustionEngine :> Engine {  // <-- NEW
}
`,
    validate: vSpec('part\\s+def', 'CombustionEngine', 'Engine',
      'Two Engine specializations — ElectricEngine and CombustionEngine. Both inherit Engine\'s attributes.',
      'Add `part def CombustionEngine :> Engine { }` on a new line.'),
  },

  {
    id: 'l3t4',
    level: 3,
    levelName: 'Specialization',
    title: 'Specialize Wheel',
    instruction:
      'Create a specialized wheel type for alloy wheels.\n\n' +
      'Add `part def AlloyWheel :> Wheel { }`',
    hint: 'Type `part def AlloyWheel :> Wheel { }` on a new line.',
    concept: 'Specialization :>',
    conceptExplanation:
      'Specialization hierarchies can be arbitrarily deep. ' +
      'You could later create PerformanceAlloyWheel :> AlloyWheel for further specialization.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    attribute cylinders : Integer;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def PoweredVehicle :> Vehicle {
}

part def ElectricEngine :> Engine {
}

part def CombustionEngine :> Engine {
}
`,
    targetCode: `\
part def AlloyWheel :> Wheel {  // <-- NEW
}
`,
    validate: vSpec('part\\s+def', 'AlloyWheel', 'Wheel',
      'AlloyWheel inherits diameter from Wheel.',
      'Add `part def AlloyWheel :> Wheel { }` on a new line.'),
  },

  {
    id: 'l3t5',
    level: 3,
    levelName: 'Specialization',
    title: 'Specialize Transmission',
    instruction:
      'Create a specialized transmission for automatic gearboxes.\n\n' +
      'Add `part def AutomaticTransmission :> Transmission { }`',
    hint: 'Type `part def AutomaticTransmission :> Transmission { }` on a new line.',
    concept: 'Specialization :>',
    conceptExplanation:
      'Specialized definitions can add attributes specific to the subtype. ' +
      'AutomaticTransmission inherits gearCount and could add attributes like shiftSpeed.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def PoweredVehicle :> Vehicle {
}

part def ElectricEngine :> Engine {
}

part def CombustionEngine :> Engine {
}

part def AlloyWheel :> Wheel {
}
`,
    targetCode: `\
part def AutomaticTransmission :> Transmission {  // <-- NEW
}
`,
    validate: vSpec('part\\s+def', 'AutomaticTransmission', 'Transmission',
      'AutomaticTransmission inherits gearCount from Transmission.',
      'Add `part def AutomaticTransmission :> Transmission { }` on a new line.'),
  },

  {
    id: 'l3t6',
    level: 3,
    levelName: 'Specialization',
    title: 'Chain Specialization',
    instruction:
      'Specialization can be chained. PoweredVehicle already specializes Vehicle.\n\n' +
      'Add `part def SportsCar :> PoweredVehicle { }` — a chain: SportsCar → PoweredVehicle → Vehicle.',
    hint: 'Type `part def SportsCar :> PoweredVehicle { }` on a new line.',
    concept: 'chained specialization',
    conceptExplanation:
      'SportsCar :> PoweredVehicle :> Vehicle forms an inheritance chain. ' +
      'SportsCar inherits all features from both PoweredVehicle and Vehicle (maxSpeed).',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def PoweredVehicle :> Vehicle {
}

part def ElectricEngine :> Engine {
}

part def CombustionEngine :> Engine {
}

part def AlloyWheel :> Wheel {
}

part def AutomaticTransmission :> Transmission {
}
`,
    targetCode: `\
// Chained: SportsCar → PoweredVehicle → Vehicle
part def SportsCar :> PoweredVehicle {  // <-- NEW
}
`,
    validate: vSpec('part\\s+def', 'SportsCar', 'PoweredVehicle',
      'SportsCar → PoweredVehicle → Vehicle: a three-level inheritance chain!',
      'Add `part def SportsCar :> PoweredVehicle { }` on a new line.'),
  },

  {
    id: 'l3t7',
    level: 3,
    levelName: 'Specialization',
    title: 'Add Attributes to a Specialization',
    instruction:
      'Specialized definitions can add new attributes beyond what they inherit.\n\n' +
      'Inside **ElectricEngine**, add: `attribute batteryCapacity : Real;`\n\n' +
      'This attribute exists only on ElectricEngine, not on Engine.',
    hint: 'Inside ElectricEngine { }, type `attribute batteryCapacity : Real;`',
    concept: 'extending specializations',
    conceptExplanation:
      'A specialized definition has all inherited features plus any new ones you add. ' +
      'Engine has mass/horsepower. ElectricEngine has mass/horsepower AND batteryCapacity.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def PoweredVehicle :> Vehicle {
}

part def ElectricEngine :> Engine {
}

part def CombustionEngine :> Engine {
}

part def SportsCar :> PoweredVehicle {
}
`,
    targetCode: `\
part def ElectricEngine :> Engine {
    attribute batteryCapacity : Real;  // <-- NEW
}
`,
    validate: vAttr('batteryCapacity', 'Real', 'ElectricEngine',
      'ElectricEngine now has batteryCapacity in addition to inherited mass and horsepower.'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 4: Composition & Multiplicity (8 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l4t1',
    level: 4,
    levelName: 'Composition',
    title: 'Add an Engine to Vehicle',
    instruction:
      'A **part usage** inside a definition creates composition — "Vehicle *owns* an Engine".\n\n' +
      'The colon `:` means "defined by" — it types the usage by a definition.\n\n' +
      'Inside **Vehicle**, add: `part eng : Engine;`',
    hint: 'Inside Vehicle { }, after the attribute, add: `part eng : Engine;`',
    concept: '«part» usage',
    conceptExplanation:
      '"part eng : Engine" means Vehicle contains exactly one Engine (default multiplicity is 1). ' +
      'Composition is the strongest ownership — the part\'s lifecycle is tied to its owner.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}
`,
    targetCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;  // <-- NEW (composition)
}
`,
    validate: vUsage('part', 'eng', 'Engine', '', 'Vehicle',
      'Vehicle now owns an Engine — eng appears nested inside Vehicle in the diagram.'),
  },

  {
    id: 'l4t2',
    level: 4,
    levelName: 'Composition',
    title: 'Add Wheels with Multiplicity',
    instruction:
      '**Multiplicity** specifies how many instances. `[4]` means exactly four.\n\n' +
      'Inside **Vehicle**, add: `part wheel[4] : Wheel;`',
    hint: 'Inside Vehicle { }, add: `part wheel[4] : Wheel;`',
    concept: 'multiplicity [n]',
    conceptExplanation:
      '[4] means exactly four Wheel instances. Other forms: [1..*] one or more, ' +
      '[0..1] optional, [*] unbounded. Default multiplicity for parts is 1.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}
`,
    targetCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;  // <-- NEW
}
`,
    validate: vMatch(
      /part\s+wheel\s*\[\s*4\s*\]\s*:\s*Wheel/,
      'Vehicle has four wheels! Multiplicity [4] means exactly four instances.',
      /part\s+wheel.*Wheel/,
      'Add the multiplicity: `part wheel[4] : Wheel;`',
      'Inside Vehicle { }, add: `part wheel[4] : Wheel;`'),
  },

  {
    id: 'l4t3',
    level: 4,
    levelName: 'Composition',
    title: 'Add Chassis to Vehicle',
    instruction:
      'Continue building the Vehicle composition.\n\n' +
      'Inside **Vehicle**, add: `part chassis : Chassis;`',
    hint: 'Inside Vehicle { }, add: `part chassis : Chassis;`',
    concept: '«part» usage',
    conceptExplanation:
      'Each part usage creates an ownership link. Vehicle now owns eng, wheel[4], and chassis. ' +
      'The nested view shows these as contained blocks inside Vehicle.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}
`,
    targetCode: `\
part def Vehicle {
    // ...existing parts...
    part chassis : Chassis;  // <-- NEW
}
`,
    validate: vUsage('part', 'chassis', 'Chassis', '', 'Vehicle',
      'Vehicle now owns a Chassis. Three parts inside Vehicle.'),
  },

  {
    id: 'l4t4',
    level: 4,
    levelName: 'Composition',
    title: 'Add Transmission to Vehicle',
    instruction:
      'Inside **Vehicle**, add: `part trans : Transmission;`',
    hint: 'Inside Vehicle { }, add: `part trans : Transmission;`',
    concept: '«part» usage',
    conceptExplanation:
      'Usage names are typically abbreviated: eng for Engine, trans for Transmission. ' +
      'This keeps the model concise while maintaining readability.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    part chassis : Chassis;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}
`,
    targetCode: `\
part def Vehicle {
    // ...existing parts...
    part trans : Transmission;  // <-- NEW
}
`,
    validate: vUsage('part', 'trans', 'Transmission', '', 'Vehicle',
      'Vehicle now owns a Transmission. Four parts inside.'),
  },

  {
    id: 'l4t5',
    level: 4,
    levelName: 'Composition',
    title: 'Add BrakeSystem to Vehicle',
    instruction:
      'Inside **Vehicle**, add: `part brakes : BrakeSystem;`',
    hint: 'Inside Vehicle { }, add: `part brakes : BrakeSystem;`',
    concept: '«part» usage',
    conceptExplanation:
      'The usage name (brakes) is independent of the definition name (BrakeSystem). ' +
      'You choose descriptive names for each context where the type is used.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    part chassis : Chassis;
    part trans : Transmission;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}
`,
    targetCode: `\
part def Vehicle {
    // ...existing parts...
    part brakes : BrakeSystem;  // <-- NEW
}
`,
    validate: vUsage('part', 'brakes', 'BrakeSystem', '', 'Vehicle',
      'Vehicle is fully composed: eng, wheel[4], chassis, trans, brakes.'),
  },

  {
    id: 'l4t6',
    level: 4,
    levelName: 'Composition',
    title: 'Nest Parts Inside Engine',
    instruction:
      'Composition can be nested — parts contain parts.\n\n' +
      'First add `part def Piston { }` as a new definition, then inside **Engine** add: `part piston[4] : Piston;`',
    hint: 'Add `part def Piston { }` then inside Engine add: `part piston[4] : Piston;`',
    concept: 'nested composition',
    conceptExplanation:
      'Deep nesting models the physical hierarchy of a system. ' +
      'Vehicle → Engine → Piston represents three levels of containment.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    part chassis : Chassis;
    part trans : Transmission;
    part brakes : BrakeSystem;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}
`,
    targetCode: `\
part def Piston {    // <-- NEW definition
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    part piston[4] : Piston;  // <-- NEW usage
}
`,
    validate: vAll([
      { pat: /part\s+def\s+Piston\b/, hint: 'Now add `part piston[4] : Piston;` inside Engine.' },
      { pat: /part\s+piston\s*\[\s*4\s*\]\s*:\s*Piston/, hint: 'Also add `part def Piston { }` as a definition.' },
    ],
    'Engine now contains 4 pistons. Nested composition: Vehicle → Engine → Piston.',
    'Add `part def Piston { }` and inside Engine add `part piston[4] : Piston;`'),
  },

  {
    id: 'l4t7',
    level: 4,
    levelName: 'Composition',
    title: 'Add Sensors with Variable Multiplicity',
    instruction:
      'Use `[1..*]` for one-or-more multiplicity.\n\n' +
      'Inside **Vehicle**, add: `part sensor[1..*] : Sensor;`\n\n' +
      'Also add `part def Sensor { }` if it\'s not already there.',
    hint: 'Inside Vehicle { }, add: `part sensor[1..*] : Sensor;`',
    concept: 'variable multiplicity',
    conceptExplanation:
      '[1..*] means "at least one, no upper bound". Other forms: [0..*] or [*] for zero or more, ' +
      '[0..1] for optional. Range multiplicities give flexibility to the model.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    part chassis : Chassis;
    part trans : Transmission;
    part brakes : BrakeSystem;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    part piston[4] : Piston;
}

part def Piston {
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def Sensor {
}
`,
    targetCode: `\
part def Vehicle {
    // ...existing parts...
    part sensor[1..*] : Sensor;  // <-- NEW
}
`,
    validate: vMatch(
      /part\s+sensor\s*\[\s*1\s*\.\.\s*\*\s*\]\s*:\s*Sensor/,
      'Variable multiplicity [1..*] — at least one sensor, no upper limit.',
      /part\s+sensor.*Sensor/,
      'Add the multiplicity: `part sensor[1..*] : Sensor;`',
      'Inside Vehicle { }, add: `part sensor[1..*] : Sensor;`'),
  },

  {
    id: 'l4t8',
    level: 4,
    levelName: 'Composition',
    title: 'Add BrakeDisc Inside BrakeSystem',
    instruction:
      'Add a new definition and usage for brake discs.\n\n' +
      'Add `part def BrakeDisc { }` then inside **BrakeSystem** add: `part disc[4] : BrakeDisc;`',
    hint: 'Add `part def BrakeDisc { }` then inside BrakeSystem add `part disc[4] : BrakeDisc;`',
    concept: 'nested composition',
    conceptExplanation:
      'The system hierarchy deepens: Vehicle → BrakeSystem → BrakeDisc. ' +
      'Each level of nesting represents physical containment in the real system.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    part chassis : Chassis;
    part trans : Transmission;
    part brakes : BrakeSystem;
    part sensor[1..*] : Sensor;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    part piston[4] : Piston;
}

part def Piston {
}

part def Wheel {
    attribute diameter : Real;
}

part def Chassis {
    attribute material : String;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def BrakeSystem {
    attribute isABS : Boolean;
}

part def Sensor {
}
`,
    targetCode: `\
part def BrakeDisc {  // <-- NEW
}

part def BrakeSystem {
    attribute isABS : Boolean;
    part disc[4] : BrakeDisc;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /part\s+def\s+BrakeDisc\b/, hint: 'Now add `part disc[4] : BrakeDisc;` inside BrakeSystem.' },
      { pat: /part\s+disc\s*\[\s*4\s*\]\s*:\s*BrakeDisc/, hint: 'Also add `part def BrakeDisc { }` as a definition.' },
    ],
    'BrakeSystem now contains 4 brake discs. Composition mastered!',
    'Add `part def BrakeDisc { }` and inside BrakeSystem add `part disc[4] : BrakeDisc;`'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 5: Subsetting (5 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l5t1',
    level: 5,
    levelName: 'Subsetting',
    title: 'Subset the Wheel Feature',
    instruction:
      '**Subsetting** (`:>` on usages) says "this feature\'s values are a subset of another feature\'s values".\n\n' +
      'PoweredVehicle inherits `wheel[4]` from Vehicle. Declare a more specific wheel.\n\n' +
      'First add `part def PoweredVehicle :> Vehicle { }` if needed, then inside it add: `part frontWheel :> wheel;`',
    hint: 'Inside PoweredVehicle { }, type `part frontWheel :> wheel;`',
    concept: 'Subsetting :>',
    conceptExplanation:
      'When :> appears on a usage (not a definition), it means "subsets". ' +
      '"frontWheel is a subset of wheel" — in every context where PoweredVehicle exists, ' +
      'frontWheel values are included in wheel values.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
}
`,
    targetCode: `\
part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;  // <-- NEW
}
`,
    validate: vSubset('frontWheel', 'wheel', 'PoweredVehicle',
      'frontWheel subsets the inherited wheel. A subsetting arrow connects them.'),
  },

  {
    id: 'l5t2',
    level: 5,
    levelName: 'Subsetting',
    title: 'Add Another Subset',
    instruction:
      'Add a second wheel subset for the rear wheels.\n\n' +
      'Inside **PoweredVehicle**, add: `part rearWheel :> wheel;`',
    hint: 'Inside PoweredVehicle { }, add: `part rearWheel :> wheel;`',
    concept: 'multiple subsets',
    conceptExplanation:
      'Multiple features can subset the same parent feature. frontWheel and rearWheel ' +
      'are both subsets of wheel — they divide the four wheels into named groups.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
}
`,
    targetCode: `\
part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
    part rearWheel :> wheel;  // <-- NEW
}
`,
    validate: vSubset('rearWheel', 'wheel', 'PoweredVehicle',
      'Two subsets of wheel: frontWheel and rearWheel.'),
  },

  {
    id: 'l5t3',
    level: 5,
    levelName: 'Subsetting',
    title: 'Chain Subsetting',
    instruction:
      'Subsetting can be chained. Create a subset of a subset.\n\n' +
      'Inside **PoweredVehicle**, add: `part leftFront :> frontWheel;`\n\n' +
      'This means leftFront ⊂ frontWheel ⊂ wheel.',
    hint: 'Inside PoweredVehicle { }, add: `part leftFront :> frontWheel;`',
    concept: 'chained subsetting',
    conceptExplanation:
      'leftFront subsets frontWheel which subsets wheel. ' +
      'This creates a hierarchy: leftFront values are in frontWheel values, which are in wheel values.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
    part rearWheel :> wheel;
}
`,
    targetCode: `\
part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
    part rearWheel :> wheel;
    part leftFront :> frontWheel;  // <-- NEW
}
`,
    validate: vSubset('leftFront', 'frontWheel', 'PoweredVehicle',
      'Chained: leftFront ⊂ frontWheel ⊂ wheel. Three levels of subsetting!'),
  },

  {
    id: 'l5t4',
    level: 5,
    levelName: 'Subsetting',
    title: 'Subset in SportsCar',
    instruction:
      'Now add subsetting in SportsCar (which specializes PoweredVehicle :> Vehicle).\n\n' +
      'Add `part def SportsCar :> PoweredVehicle { }` with `part drivingWheel :> rearWheel;` inside.',
    hint: 'Add `part def SportsCar :> PoweredVehicle { part drivingWheel :> rearWheel; }`',
    concept: 'subsetting in subtypes',
    conceptExplanation:
      'SportsCar inherits all of PoweredVehicle\'s features (which inherits from Vehicle). ' +
      'Subsetting in a subtype further refines the inherited hierarchy.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
    part rearWheel :> wheel;
    part leftFront :> frontWheel;
}
`,
    targetCode: `\
part def SportsCar :> PoweredVehicle {
    part drivingWheel :> rearWheel;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /part\s+def\s+SportsCar\s*:>\s*PoweredVehicle/, hint: 'Inside SportsCar, add: `part drivingWheel :> rearWheel;`' },
      { pat: /part\s+drivingWheel\s*:>\s*rearWheel/, hint: 'Also add: `part def SportsCar :> PoweredVehicle { }`' },
    ],
    'SportsCar has drivingWheel subsetting rearWheel — rear-wheel drive sports car!',
    'Add `part def SportsCar :> PoweredVehicle { part drivingWheel :> rearWheel; }`'),
  },

  {
    id: 'l5t5',
    level: 5,
    levelName: 'Subsetting',
    title: 'Subset Engine Parts',
    instruction:
      'Subsetting works on any part usage, not just wheels.\n\n' +
      'Inside a new `part def TurboEngine :> Engine { }`, add: `part turboPiston :> piston;`\n\n' +
      '(Engine has `part piston[4] : Piston;` — add it if needed.)',
    hint: 'Add `part def TurboEngine :> Engine { part turboPiston :> piston; }`',
    concept: 'subsetting non-wheel features',
    conceptExplanation:
      'Subsetting applies to any usage, not just a specific type. ' +
      'Here turboPiston is a named subset of the inherited piston[4] feature.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    part piston[4] : Piston;
}

part def Piston {
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
    part rearWheel :> wheel;
}

part def SportsCar :> PoweredVehicle {
    part drivingWheel :> rearWheel;
}
`,
    targetCode: `\
part def TurboEngine :> Engine {
    part turboPiston :> piston;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /part\s+def\s+TurboEngine\s*:>\s*Engine/, hint: 'Inside TurboEngine, add: `part turboPiston :> piston;`' },
      { pat: /part\s+turboPiston\s*:>\s*piston/, hint: 'Also add: `part def TurboEngine :> Engine { }`' },
    ],
    'TurboEngine has turboPiston subsetting the inherited piston. Subsetting mastered!',
    'Add `part def TurboEngine :> Engine { part turboPiston :> piston; }`'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 6: Redefinition (5 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l6t1',
    level: 6,
    levelName: 'Redefinition',
    title: 'Redefine an Inherited Feature',
    instruction:
      '**Redefinition** (`:>>`) *replaces* an inherited feature with a new name and/or specialized type.\n\n' +
      'Create `part def SmallVehicle :> Vehicle { }` and inside it add: `part smallEng :>> eng;`\n\n' +
      'This replaces the inherited `eng` with `smallEng`.',
    hint: 'Add `part def SmallVehicle :> Vehicle { part smallEng :>> eng; }`',
    concept: 'Redefinition :>>',
    conceptExplanation:
      ':>> is equivalent to the "redefines" keyword. ' +
      '"part smallEng :>> eng" means SmallVehicle replaces the inherited eng with smallEng. ' +
      'Redefinition can change name, specialize type, and constrain multiplicity.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
    part rearWheel :> wheel;
}
`,
    targetCode: `\
part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;  // <-- NEW (redefines)
}
// :>> replaces the inherited eng
`,
    validate: vAll([
      { pat: /part\s+def\s+SmallVehicle\s*:>\s*Vehicle/, hint: 'Inside SmallVehicle, add: `part smallEng :>> eng;`' },
      { pat: /part\s+smallEng\s*:>>\s*eng/, hint: 'Also add: `part def SmallVehicle :> Vehicle { }`' },
    ],
    'SmallVehicle redefines eng as smallEng. A redefinition arrow connects them.',
    'Add `part def SmallVehicle :> Vehicle { part smallEng :>> eng; }`'),
  },

  {
    id: 'l6t2',
    level: 6,
    levelName: 'Redefinition',
    title: 'Redefine Wheels in SportsCar',
    instruction:
      'SportsCar should have sport wheels instead of regular ones.\n\n' +
      'Inside a `part def SportsCar :> Vehicle { }`, add: `part sportWheel :>> wheel;`',
    hint: 'Add `part def SportsCar :> Vehicle { part sportWheel :>> wheel; }`',
    concept: 'Redefinition :>>',
    conceptExplanation:
      'sportWheel redefines (replaces) the inherited wheel[4]. ' +
      'In SportsCar, the wheel feature is now called sportWheel.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;
}
`,
    targetCode: `\
part def SportsCar :> Vehicle {
    part sportWheel :>> wheel;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /part\s+def\s+SportsCar\s*:>\s*Vehicle/, hint: 'Inside SportsCar, add: `part sportWheel :>> wheel;`' },
      { pat: /part\s+sportWheel\s*:>>\s*wheel/, hint: 'Also add: `part def SportsCar :> Vehicle { }`' },
    ],
    'SportsCar redefines wheel as sportWheel.',
    'Add `part def SportsCar :> Vehicle { part sportWheel :>> wheel; }`'),
  },

  {
    id: 'l6t3',
    level: 6,
    levelName: 'Redefinition',
    title: 'Redefine with Specialization',
    instruction:
      'Redefinition can also specialize the type. Create `part def SmallEngine :> Engine { }`, ' +
      'then inside **SmallVehicle** redefine eng with a typed redefinition.\n\n' +
      'Change SmallVehicle\'s smallEng to: `part smallEng :>> eng : SmallEngine;`',
    hint: 'Syntax: `part smallEng :>> eng : SmallEngine;` — redefines eng AND types it as SmallEngine.',
    concept: 'typed redefinition',
    conceptExplanation:
      'A typed redefinition replaces the feature AND specializes its type. ' +
      '"part smallEng :>> eng : SmallEngine" means smallEng replaces eng and is typed by SmallEngine.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng;
}

part def SportsCar :> Vehicle {
    part sportWheel :>> wheel;
}
`,
    targetCode: `\
part def SmallEngine :> Engine {  // <-- NEW
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng : SmallEngine;  // <-- UPDATED
}
`,
    validate: vAll([
      { pat: /part\s+def\s+SmallEngine\s*:>\s*Engine/, hint: 'Now update SmallVehicle: `part smallEng :>> eng : SmallEngine;`' },
      { pat: /part\s+smallEng\s*:>>\s*eng\s*:\s*SmallEngine/, hint: 'Also add `part def SmallEngine :> Engine { }`' },
    ],
    'Typed redefinition: smallEng replaces eng AND is typed by SmallEngine.',
    'Add `part def SmallEngine :> Engine { }` and update `part smallEng :>> eng : SmallEngine;`'),
  },

  {
    id: 'l6t4',
    level: 6,
    levelName: 'Redefinition',
    title: 'Redefine Transmission',
    instruction:
      'Create `part def AutomaticTransmission :> Transmission { }`, then create an `ElectricCar :> Vehicle` ' +
      'that redefines trans.\n\n' +
      'Inside ElectricCar, add: `part autoTrans :>> trans;`',
    hint: 'Add ElectricCar :> Vehicle with `part autoTrans :>> trans;` inside.',
    concept: 'Redefinition :>>',
    conceptExplanation:
      'Each specialized vehicle type can redefine different inherited parts. ' +
      'This is how you configure a specific vehicle variant.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    part trans : Transmission;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def SmallEngine :> Engine {
}

part def SmallVehicle :> Vehicle {
    part smallEng :>> eng : SmallEngine;
}
`,
    targetCode: `\
part def AutomaticTransmission :> Transmission {  // <-- NEW
}

part def ElectricCar :> Vehicle {
    part autoTrans :>> trans;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /part\s+def\s+ElectricCar\s*:>\s*Vehicle/, hint: 'Inside ElectricCar, add: `part autoTrans :>> trans;`' },
      { pat: /part\s+autoTrans\s*:>>\s*trans/, hint: 'Also add: `part def ElectricCar :> Vehicle { }`' },
    ],
    'ElectricCar redefines trans as autoTrans. Redefinition mastered!',
    'Add `part def ElectricCar :> Vehicle { part autoTrans :>> trans; }`'),
  },

  {
    id: 'l6t5',
    level: 6,
    levelName: 'Redefinition',
    title: 'Multiple Redefinitions',
    instruction:
      'A specialized definition can redefine multiple inherited features at once.\n\n' +
      'Inside **SportsCar**, redefine both eng and wheel:\n' +
      '- `part raceEng :>> eng;`\n' +
      '- `part raceWheel :>> wheel;`',
    hint: 'Inside SportsCar { }, add both redefinition lines.',
    concept: 'multiple redefinitions',
    conceptExplanation:
      'A single specialized definition can redefine any number of inherited features. ' +
      'This is how you fully configure a specialized variant of a base type.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    part trans : Transmission;
}

part def Engine {
    attribute mass : Real;
}

part def Wheel {
    attribute diameter : Real;
}

part def Transmission {
    attribute gearCount : Integer;
}

part def SportsCar :> Vehicle {
}
`,
    targetCode: `\
part def SportsCar :> Vehicle {
    part raceEng :>> eng;     // <-- NEW
    part raceWheel :>> wheel; // <-- NEW
}
`,
    validate: vAll([
      { pat: /part\s+raceEng\s*:>>\s*eng/, hint: 'Also add: `part raceWheel :>> wheel;`' },
      { pat: /part\s+raceWheel\s*:>>\s*wheel/, hint: 'Also add: `part raceEng :>> eng;`' },
    ],
    'SportsCar redefines both eng and wheel. Multiple redefinitions done!',
    'Inside SportsCar { }, add: `part raceEng :>> eng;` and `part raceWheel :>> wheel;`'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 7: Ports & Directed Features (8 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l7t1',
    level: 7,
    levelName: 'Ports',
    title: 'Create a Port Definition',
    instruction:
      'A **port def** defines a connection contract at a system boundary.\n\n' +
      'Ports specify how parts interact with the outside world.\n\n' +
      'Add `port def FuelPort { }` to the model.',
    hint: 'Type `port def FuelPort { }` on a new line.',
    concept: '«port def»',
    conceptExplanation:
      'Port definitions replace interface blocks from SysML v1. ' +
      'They specify the "shape" of a connection point. ' +
      'Every port def also has an implicit conjugate (~FuelPort) that reverses in/out directions.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}
`,
    targetCode: `\
// Add a port definition:
port def FuelPort {  // <-- NEW
}
`,
    validate: vDef('port\\s+def', 'FuelPort',
      'FuelPort is now a port definition. Next you\'ll place it on Vehicle.',
      'Add `port def FuelPort { }` to the model.'),
  },

  {
    id: 'l7t2',
    level: 7,
    levelName: 'Ports',
    title: 'Add a Port Usage',
    instruction:
      'A **port usage** places a connection point on a block\'s boundary.\n\n' +
      'Inside **Vehicle**, add: `port fuelPort : FuelPort;`',
    hint: 'Inside Vehicle { }, add: `port fuelPort : FuelPort;`',
    concept: 'port usage',
    conceptExplanation:
      'A port usage must reference a port definition. ' +
      'In the diagram, the port appears on the boundary of the definition block.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

port def FuelPort {
}
`,
    targetCode: `\
part def Vehicle {
    // ...existing parts...
    port fuelPort : FuelPort;  // <-- NEW
}
`,
    validate: vUsage('port', 'fuelPort', 'FuelPort', '', 'Vehicle',
      'Vehicle now has a fuelPort connection point.'),
  },

  {
    id: 'l7t3',
    level: 7,
    levelName: 'Ports',
    title: 'Create an Electric Port',
    instruction:
      'Add another port definition for electrical connections.\n\n' +
      'Add `port def ElectricPort { }`',
    hint: 'Type `port def ElectricPort { }` on a new line.',
    concept: '«port def»',
    conceptExplanation:
      'Different port definitions represent different connection types. ' +
      'FuelPort handles fuel, ElectricPort handles electricity. ' +
      'This enforces type safety — you can\'t connect incompatible ports.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

port def FuelPort {
}
`,
    targetCode: `\
port def ElectricPort {  // <-- NEW
}
`,
    validate: vDef('port\\s+def', 'ElectricPort',
      'ElectricPort defined. Two port types for different connection contracts.',
      'Add `port def ElectricPort { }` to the model.'),
  },

  {
    id: 'l7t4',
    level: 7,
    levelName: 'Ports',
    title: 'Add Directed Features (in)',
    instruction:
      'Port definitions can have **directed features** that specify flow direction.\n\n' +
      'Inside **FuelPort**, add: `in attribute fuelIn : Real;`\n\n' +
      'The `in` keyword means this port *receives* fuel.',
    hint: 'Inside FuelPort { }, type `in attribute fuelIn : Real;`',
    concept: 'in / out / inout',
    conceptExplanation:
      '"in" means the port receives. "out" means it sends. "inout" means bidirectional. ' +
      'Directed features determine port compatibility for connections.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

port def FuelPort {
}

port def ElectricPort {
}
`,
    targetCode: `\
port def FuelPort {
    in attribute fuelIn : Real;  // <-- NEW
}
`,
    validate: vMatch(
      /in\s+attribute\s+fuelIn\s*:\s*Real/,
      'FuelPort receives fuel through fuelIn. The "in" direction marks it as an input.',
      /fuelIn/,
      'Use the "in" keyword: `in attribute fuelIn : Real;`',
      'Inside FuelPort { }, add: `in attribute fuelIn : Real;`'),
  },

  {
    id: 'l7t5',
    level: 7,
    levelName: 'Ports',
    title: 'Add an Output Feature',
    instruction:
      'Now add an output feature to FuelPort.\n\n' +
      'Inside **FuelPort**, add: `out attribute exhaustOut : Real;`\n\n' +
      'This represents exhaust leaving through the fuel port.',
    hint: 'Inside FuelPort { }, add: `out attribute exhaustOut : Real;`',
    concept: 'out direction',
    conceptExplanation:
      'A port with both "in" and "out" features defines a bidirectional contract. ' +
      'Fuel comes in, exhaust goes out. The conjugate port (~FuelPort) reverses these directions.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

port def FuelPort {
    in attribute fuelIn : Real;
}

port def ElectricPort {
}
`,
    targetCode: `\
port def FuelPort {
    in attribute fuelIn : Real;
    out attribute exhaustOut : Real;  // <-- NEW
}
`,
    validate: vMatch(
      /out\s+attribute\s+exhaustOut\s*:\s*Real/,
      'FuelPort now has both in (fuelIn) and out (exhaustOut) directed features.',
      /exhaustOut/,
      'Use the "out" keyword: `out attribute exhaustOut : Real;`',
      'Inside FuelPort { }, add: `out attribute exhaustOut : Real;`'),
  },

  {
    id: 'l7t6',
    level: 7,
    levelName: 'Ports',
    title: 'Add Directed Features to ElectricPort',
    instruction:
      'Add directed features to ElectricPort:\n\n' +
      '- `in attribute powerIn : Real;`\n' +
      '- `out attribute dataOut : Real;`',
    hint: 'Inside ElectricPort { }, add both directed attribute lines.',
    concept: 'in / out on ports',
    conceptExplanation:
      'Ports with matching directed features are compatible for connection. ' +
      'If Port A has "out X" and Port B has "in X", they can be connected.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

port def FuelPort {
    in attribute fuelIn : Real;
    out attribute exhaustOut : Real;
}

port def ElectricPort {
}
`,
    targetCode: `\
port def ElectricPort {
    in attribute powerIn : Real;   // <-- NEW
    out attribute dataOut : Real;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /in\s+attribute\s+powerIn\s*:\s*Real/, hint: 'Also add: `out attribute dataOut : Real;`' },
      { pat: /out\s+attribute\s+dataOut\s*:\s*Real/, hint: 'Also add: `in attribute powerIn : Real;`' },
    ],
    'ElectricPort has power in and data out. Port contract fully defined.',
    'Inside ElectricPort { }, add both directed features.'),
  },

  {
    id: 'l7t7',
    level: 7,
    levelName: 'Ports',
    title: 'Add Port to Engine',
    instruction:
      'Engines also need ports. Add a port to **Engine** for its fuel connection.\n\n' +
      'Inside **Engine**, add: `port engineFuel : FuelPort;`',
    hint: 'Inside Engine { }, add: `port engineFuel : FuelPort;`',
    concept: 'port usage',
    conceptExplanation:
      'Multiple parts can use the same port definition. Both Vehicle and Engine ' +
      'have FuelPort — they can be connected through compatible ports.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

part def Wheel {
    attribute diameter : Real;
}

port def FuelPort {
    in attribute fuelIn : Real;
    out attribute exhaustOut : Real;
}

port def ElectricPort {
    in attribute powerIn : Real;
    out attribute dataOut : Real;
}
`,
    targetCode: `\
part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    port engineFuel : FuelPort;  // <-- NEW
}
`,
    validate: vUsage('port', 'engineFuel', 'FuelPort', '', 'Engine',
      'Engine now has a FuelPort. Both Vehicle and Engine have compatible fuel ports.'),
  },

  {
    id: 'l7t8',
    level: 7,
    levelName: 'Ports',
    title: 'Create a Data Port',
    instruction:
      'Create one more port type for sensor data communication.\n\n' +
      'Add `port def DataPort { }` with `inout attribute signal : Real;` inside.\n\n' +
      'The **`inout`** keyword means the port both sends and receives.',
    hint: 'Add `port def DataPort { inout attribute signal : Real; }`',
    concept: 'inout direction',
    conceptExplanation:
      '"inout" combines "in" and "out" — the port both sends and receives through the same feature. ' +
      'This is useful for bidirectional data buses and control signals.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    port engineFuel : FuelPort;
}

part def Wheel {
    attribute diameter : Real;
}

port def FuelPort {
    in attribute fuelIn : Real;
    out attribute exhaustOut : Real;
}

port def ElectricPort {
    in attribute powerIn : Real;
    out attribute dataOut : Real;
}
`,
    targetCode: `\
port def DataPort {
    inout attribute signal : Real;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /port\s+def\s+DataPort\b/, hint: 'Inside DataPort, add: `inout attribute signal : Real;`' },
      { pat: /inout\s+attribute\s+signal\s*:\s*Real/, hint: 'Also add: `port def DataPort { }`' },
    ],
    'DataPort with inout signal. Ports and directed features mastered!',
    'Add `port def DataPort { inout attribute signal : Real; }`'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 8: Items & Connections (6 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l8t1',
    level: 8,
    levelName: 'Items & Connections',
    title: 'Create an Item Definition',
    instruction:
      'An **item def** defines things that exist in space and time but are not necessarily parts of the system.\n\n' +
      'Items model what flows through connections: data, signals, energy, or material.\n\n' +
      'Add `item def Fuel { }`',
    hint: 'Type `item def Fuel { }` on a new line.',
    concept: '«item def»',
    conceptExplanation:
      'All parts can be treated as items, but not all items are parts. ' +
      'Fuel flows through the system but is not a structural part of the vehicle. ' +
      'An item is continuous if any portion of it is the same kind of thing.',
    starterCode: `\
part def Vehicle {
    part eng : Engine;
    port fuelPort : FuelPort;
}

part def Engine {
    port engineFuel : FuelPort;
}

port def FuelPort {
    in attribute fuelIn : Real;
}
`,
    targetCode: `\
item def Fuel {  // <-- NEW
}
`,
    validate: vDef('item\\s+def', 'Fuel',
      'Fuel is now an item definition — something that flows, not a structural part.',
      'Add `item def Fuel { }` to the model.'),
  },

  {
    id: 'l8t2',
    level: 8,
    levelName: 'Items & Connections',
    title: 'Create More Items',
    instruction:
      'Create two more item definitions:\n\n' +
      '- `item def Electricity { }`\n' +
      '- `item def ExhaustGas { }`',
    hint: 'Add both `item def Electricity { }` and `item def ExhaustGas { }` on new lines.',
    concept: '«item def»',
    conceptExplanation:
      'Different items represent different types of flow. Fuel, electricity, and exhaust gas ' +
      'all flow through the vehicle system but are fundamentally different things.',
    starterCode: `\
part def Vehicle {
    part eng : Engine;
    port fuelPort : FuelPort;
}

part def Engine {
    port engineFuel : FuelPort;
}

port def FuelPort {
    in attribute fuelIn : Real;
}

item def Fuel {
}
`,
    targetCode: `\
item def Electricity {  // <-- NEW
}

item def ExhaustGas {  // <-- NEW
}
`,
    validate: vAll([
      { pat: /item\s+def\s+Electricity\b/, hint: 'Also add: `item def ExhaustGas { }`' },
      { pat: /item\s+def\s+ExhaustGas\b/, hint: 'Also add: `item def Electricity { }`' },
    ],
    'Three item types defined: Fuel, Electricity, and ExhaustGas.',
    'Add `item def Electricity { }` and `item def ExhaustGas { }`'),
  },

  {
    id: 'l8t3',
    level: 8,
    levelName: 'Items & Connections',
    title: 'Add Attributes to Items',
    instruction:
      'Items can have attributes just like parts.\n\n' +
      'Inside **Fuel**, add: `attribute octaneRating : Integer;`',
    hint: 'Inside Fuel { }, type `attribute octaneRating : Integer;`',
    concept: 'item attributes',
    conceptExplanation:
      'Item attributes describe properties of the flowing element. ' +
      'Fuel has an octane rating, electricity has voltage, etc.',
    starterCode: `\
part def Vehicle {
    part eng : Engine;
    port fuelPort : FuelPort;
}

part def Engine {
    port engineFuel : FuelPort;
}

port def FuelPort {
    in attribute fuelIn : Real;
}

item def Fuel {
}

item def Electricity {
}

item def ExhaustGas {
}
`,
    targetCode: `\
item def Fuel {
    attribute octaneRating : Integer;  // <-- NEW
}
`,
    validate: vAttr('octaneRating', 'Integer', 'Fuel',
      'Fuel now has an octaneRating attribute.'),
  },

  {
    id: 'l8t4',
    level: 8,
    levelName: 'Items & Connections',
    title: 'Create a Connection Definition',
    instruction:
      'A **connection def** defines a type of physical or logical connection between parts.\n\n' +
      'Add `connection def FuelLine { }`',
    hint: 'Type `connection def FuelLine { }` on a new line.',
    concept: '«connection def»',
    conceptExplanation:
      'Connection definitions specify how parts are linked. A FuelLine connects fuel ports. ' +
      'Connections carry items (Fuel) between the connected parts.',
    starterCode: `\
part def Vehicle {
    part eng : Engine;
    port fuelPort : FuelPort;
}

part def Engine {
    port engineFuel : FuelPort;
}

port def FuelPort {
    in attribute fuelIn : Real;
}

item def Fuel {
    attribute octaneRating : Integer;
}

item def Electricity {
}

item def ExhaustGas {
}
`,
    targetCode: `\
connection def FuelLine {  // <-- NEW
}
`,
    validate: vDef('connection\\s+def', 'FuelLine',
      'FuelLine is a connection definition — it types connections between fuel ports.',
      'Add `connection def FuelLine { }` to the model.'),
  },

  {
    id: 'l8t5',
    level: 8,
    levelName: 'Items & Connections',
    title: 'Create an Interface Definition',
    instruction:
      'An **interface def** is similar to a connection def but emphasizes the boundary/contract.\n\n' +
      'Add `interface def PowerInterface { }`',
    hint: 'Type `interface def PowerInterface { }` on a new line.',
    concept: '«interface def»',
    conceptExplanation:
      'Interface definitions focus on what is exposed at boundaries. ' +
      'They complement connection definitions that focus on what flows between parts.',
    starterCode: `\
part def Vehicle {
    part eng : Engine;
    port fuelPort : FuelPort;
}

part def Engine {
    port engineFuel : FuelPort;
}

port def FuelPort {
    in attribute fuelIn : Real;
}

item def Fuel {
    attribute octaneRating : Integer;
}

item def Electricity {
}

connection def FuelLine {
}
`,
    targetCode: `\
interface def PowerInterface {  // <-- NEW
}
`,
    validate: vDef('interface\\s+def', 'PowerInterface',
      'PowerInterface defined — an interface contract for power connections.',
      'Add `interface def PowerInterface { }` to the model.'),
  },

  {
    id: 'l8t6',
    level: 8,
    levelName: 'Items & Connections',
    title: 'Add Item Usage Inside Connection',
    instruction:
      'Items flow through connections. Add an item usage inside FuelLine.\n\n' +
      'Inside **FuelLine**, add: `item fuelFlow : Fuel;`',
    hint: 'Inside FuelLine { }, add: `item fuelFlow : Fuel;`',
    concept: 'item flow',
    conceptExplanation:
      'An item usage inside a connection represents what flows through that connection. ' +
      'FuelLine carries Fuel — this completes the flow model.',
    starterCode: `\
part def Vehicle {
    part eng : Engine;
    port fuelPort : FuelPort;
}

part def Engine {
    port engineFuel : FuelPort;
}

port def FuelPort {
    in attribute fuelIn : Real;
}

item def Fuel {
    attribute octaneRating : Integer;
}

connection def FuelLine {
}

interface def PowerInterface {
}
`,
    targetCode: `\
connection def FuelLine {
    item fuelFlow : Fuel;  // <-- NEW
}
`,
    validate: vUsage('item', 'fuelFlow', 'Fuel', '', 'FuelLine',
      'Fuel flows through FuelLine. Items and connections mastered!'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 9: Enumerations (5 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l9t1',
    level: 9,
    levelName: 'Enumerations',
    title: 'Create an Enumeration',
    instruction:
      'An **enum def** defines a fixed set of named values.\n\n' +
      'Add `enum def FuelType { }`',
    hint: 'Type `enum def FuelType { }` on a new line.',
    concept: '«enum def»',
    conceptExplanation:
      'Enumerations are types with a finite, named set of possible values. ' +
      'They are preferred over String when the set of valid values is known and fixed.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}
`,
    targetCode: `\
enum def FuelType {  // <-- NEW
}
`,
    validate: vDef('enum\\s+def', 'FuelType',
      'FuelType is now an enumeration definition. Next: add its values.',
      'Add `enum def FuelType { }` to the model.'),
  },

  {
    id: 'l9t2',
    level: 9,
    levelName: 'Enumerations',
    title: 'Add Enum Values',
    instruction:
      'Add three values inside FuelType:\n\n' +
      '- `Gasoline;`\n' +
      '- `Diesel;`\n' +
      '- `Electric;`',
    hint: 'Inside FuelType { }, add three lines: `Gasoline;` then `Diesel;` then `Electric;`',
    concept: 'enum values',
    conceptExplanation:
      'Each value inside an enum is a member of that type. ' +
      'An attribute typed by FuelType can only have one of these three values.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

enum def FuelType {
}
`,
    targetCode: `\
enum def FuelType {
    Gasoline;  // <-- NEW
    Diesel;    // <-- NEW
    Electric;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /Gasoline/, hint: 'Also add: `Diesel;` and `Electric;`' },
      { pat: /Diesel/, hint: 'Also add: `Gasoline;` and `Electric;`' },
      { pat: /Electric/, hint: 'Also add: `Gasoline;` and `Diesel;`' },
    ],
    'FuelType has three values: Gasoline, Diesel, Electric.',
    'Inside FuelType { }, add: `Gasoline;` `Diesel;` `Electric;`'),
  },

  {
    id: 'l9t3',
    level: 9,
    levelName: 'Enumerations',
    title: 'Use Enum as Attribute Type',
    instruction:
      'Now use FuelType as an attribute type.\n\n' +
      'Inside **Engine**, add: `attribute fuelType : FuelType;`',
    hint: 'Inside Engine { }, add: `attribute fuelType : FuelType;`',
    concept: 'enum as type',
    conceptExplanation:
      'Enums are used like any other type. "attribute fuelType : FuelType" means ' +
      'the engine\'s fuel type must be one of Gasoline, Diesel, or Electric.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
}

enum def FuelType {
    Gasoline;
    Diesel;
    Electric;
}
`,
    targetCode: `\
part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    attribute fuelType : FuelType;  // <-- NEW
}
`,
    validate: vAttr('fuelType', 'FuelType', 'Engine',
      'Engine now has a fuelType attribute typed by the FuelType enum.'),
  },

  {
    id: 'l9t4',
    level: 9,
    levelName: 'Enumerations',
    title: 'Create Another Enum',
    instruction:
      'Create an enumeration for transmission modes.\n\n' +
      'Add `enum def TransmissionMode { }` with values `Manual;`, `Automatic;`, `CVT;`',
    hint: 'Add `enum def TransmissionMode { Manual; Automatic; CVT; }`',
    concept: '«enum def»',
    conceptExplanation:
      'Each domain concept with a fixed set of options should be an enumeration. ' +
      'TransmissionMode restricts the possible values to Manual, Automatic, or CVT.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    attribute fuelType : FuelType;
}

enum def FuelType {
    Gasoline;
    Diesel;
    Electric;
}
`,
    targetCode: `\
enum def TransmissionMode {
    Manual;     // <-- NEW
    Automatic;  // <-- NEW
    CVT;        // <-- NEW
}
`,
    validate: vAll([
      { pat: /enum\s+def\s+TransmissionMode\b/, hint: 'Add values inside: `Manual;` `Automatic;` `CVT;`' },
      { pat: /Manual/, hint: 'Also add `Automatic;` and `CVT;`' },
      { pat: /Automatic/, hint: 'Also add `Manual;` and `CVT;`' },
      { pat: /CVT/, hint: 'Also add `Manual;` and `Automatic;`' },
    ],
    'TransmissionMode enum with Manual, Automatic, CVT values.',
    'Add `enum def TransmissionMode { Manual; Automatic; CVT; }`'),
  },

  {
    id: 'l9t5',
    level: 9,
    levelName: 'Enumerations',
    title: 'Create a Color Enum',
    instruction:
      'Create `enum def Color { }` with values `Red;`, `Blue;`, `Black;`, `White;`, `Silver;`\n\n' +
      'Then add `attribute color : Color;` inside **Vehicle**.',
    hint: 'Add the Color enum with five values, then add `attribute color : Color;` inside Vehicle.',
    concept: 'enum usage',
    conceptExplanation:
      'Enumerations make models precise. Instead of "attribute color : String" (any text), ' +
      '"attribute color : Color" constrains the value to exactly the defined set.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Engine {
    attribute mass : Real;
    attribute fuelType : FuelType;
}

enum def FuelType {
    Gasoline;
    Diesel;
    Electric;
}

enum def TransmissionMode {
    Manual;
    Automatic;
    CVT;
}
`,
    targetCode: `\
enum def Color {
    Red; Blue; Black; White; Silver;  // <-- NEW
}

part def Vehicle {
    attribute maxSpeed : Real;
    attribute color : Color;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /enum\s+def\s+Color\b/, hint: 'Now add `attribute color : Color;` inside Vehicle.' },
      { pat: /attribute\s+color\s*:\s*Color/, hint: 'Also add the `enum def Color { }` with values.' },
    ],
    'Vehicle has a Color attribute from a fixed enum. Enumerations mastered!',
    'Add `enum def Color { Red; Blue; Black; White; Silver; }` and `attribute color : Color;` in Vehicle.'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 10: Actions & Flows (10 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l10t1',
    level: 10,
    levelName: 'Actions',
    title: 'Create an Action Definition',
    instruction:
      'An **action def** defines a behavior — something the system does.\n\n' +
      'Actions are the behavioral counterpart to structural part definitions.\n\n' +
      'Add `action def StartEngine { }`',
    hint: 'Type `action def StartEngine { }` on a new line.',
    concept: '«action def»',
    conceptExplanation:
      'Action definitions model behaviors, processes, and transformations. ' +
      'They can have parameters (in/out), nested actions, and temporal ordering via successions.',
    starterCode: `\
// Spacecraft Mission — Behavioral Model
// action def defines a step or behavior.
`,
    targetCode: `\
action def StartEngine {  // <-- NEW
}
`,
    validate: vDef('action\\s+def', 'StartEngine',
      'StartEngine is now an action definition — a behavioral blueprint.',
      'Add `action def StartEngine { }` on a new line.'),
  },

  {
    id: 'l10t2',
    level: 10,
    levelName: 'Actions',
    title: 'Create More Actions',
    instruction:
      'Create three more action definitions for a drive sequence:\n\n' +
      '- `action def Accelerate { }`\n' +
      '- `action def Cruise { }`\n' +
      '- `action def Brake { }`',
    hint: 'Add all three action definitions on new lines.',
    concept: '«action def»',
    conceptExplanation:
      'Each distinct behavior gets its own action definition. ' +
      'Later you\'ll compose them into sequences with temporal ordering.',
    starterCode: `\
action def StartEngine {
}
`,
    targetCode: `\
action def Accelerate {  // <-- NEW
}

action def Cruise {  // <-- NEW
}

action def Brake {  // <-- NEW
}
`,
    validate: vAll([
      { pat: /action\s+def\s+Accelerate\b/, hint: 'Also add: `action def Cruise { }` and `action def Brake { }`' },
      { pat: /action\s+def\s+Cruise\b/, hint: 'Also add: `action def Accelerate { }` and `action def Brake { }`' },
      { pat: /action\s+def\s+Brake\b/, hint: 'Also add: `action def Accelerate { }` and `action def Cruise { }`' },
    ],
    'Four action definitions ready for sequencing.',
    'Add `action def Accelerate { }`, `action def Cruise { }`, and `action def Brake { }`'),
  },

  {
    id: 'l10t3',
    level: 10,
    levelName: 'Actions',
    title: 'Add Parameters to an Action',
    instruction:
      'Actions can have **input** and **output** parameters.\n\n' +
      'Inside **StartEngine**, add:\n' +
      '- `in item ignitionKey : Boolean;`\n' +
      '- `out item engineRunning : Boolean;`',
    hint: 'Inside StartEngine { }, add both in and out parameter lines.',
    concept: 'action parameters',
    conceptExplanation:
      'Action parameters define what goes in and what comes out. ' +
      '"in" parameters are inputs consumed by the action. "out" parameters are outputs produced.',
    starterCode: `\
action def StartEngine {
}

action def Accelerate {
}

action def Cruise {
}

action def Brake {
}
`,
    targetCode: `\
action def StartEngine {
    in item ignitionKey : Boolean;    // <-- NEW
    out item engineRunning : Boolean; // <-- NEW
}
`,
    validate: vAll([
      { pat: /in\s+item\s+ignitionKey/, hint: 'Also add: `out item engineRunning : Boolean;`' },
      { pat: /out\s+item\s+engineRunning/, hint: 'Also add: `in item ignitionKey : Boolean;`' },
    ],
    'StartEngine has input (ignitionKey) and output (engineRunning) parameters.',
    'Inside StartEngine { }, add: `in item ignitionKey : Boolean;` and `out item engineRunning : Boolean;`'),
  },

  {
    id: 'l10t4',
    level: 10,
    levelName: 'Actions',
    title: 'Create a Composite Action',
    instruction:
      'Create a composite **DriveCycle** action that contains action usages.\n\n' +
      'Add `action def DriveCycle { }` with these action usages inside:\n' +
      '- `action start : StartEngine;`\n' +
      '- `action accel : Accelerate;`',
    hint: 'Add `action def DriveCycle { action start : StartEngine; action accel : Accelerate; }`',
    concept: 'composite action',
    conceptExplanation:
      'Like part usages inside part defs, action usages inside action defs create a behavioral hierarchy. ' +
      'DriveCycle owns start and accel as sub-actions.',
    starterCode: `\
action def StartEngine {
    in item ignitionKey : Boolean;
    out item engineRunning : Boolean;
}

action def Accelerate {
}

action def Cruise {
}

action def Brake {
}
`,
    targetCode: `\
action def DriveCycle {
    action start : StartEngine;    // <-- NEW
    action accel : Accelerate;     // <-- NEW
}
`,
    validate: vAll([
      { pat: /action\s+def\s+DriveCycle\b/, hint: 'Add action usages inside DriveCycle.' },
      { pat: /action\s+start\s*:\s*StartEngine/, hint: 'Also add: `action accel : Accelerate;`' },
      { pat: /action\s+accel\s*:\s*Accelerate/, hint: 'Also add: `action start : StartEngine;`' },
    ],
    'DriveCycle contains start and accel sub-actions.',
    'Add `action def DriveCycle { }` with action usages inside.'),
  },

  {
    id: 'l10t5',
    level: 10,
    levelName: 'Actions',
    title: 'Add More Sub-Actions',
    instruction:
      'Continue building DriveCycle. Inside it, add:\n\n' +
      '- `action cruise : Cruise;`\n' +
      '- `action brake : Brake;`',
    hint: 'Inside DriveCycle { }, add both action usage lines.',
    concept: 'composite action',
    conceptExplanation:
      'A complete drive cycle has four steps: start → accelerate → cruise → brake. ' +
      'Next you\'ll order them with successions.',
    starterCode: `\
action def StartEngine {
    in item ignitionKey : Boolean;
    out item engineRunning : Boolean;
}

action def Accelerate {
}

action def Cruise {
}

action def Brake {
}

action def DriveCycle {
    action start : StartEngine;
    action accel : Accelerate;
}
`,
    targetCode: `\
action def DriveCycle {
    action start : StartEngine;
    action accel : Accelerate;
    action cruise : Cruise;  // <-- NEW
    action brake : Brake;    // <-- NEW
}
`,
    validate: vAll([
      { pat: /action\s+cruise\s*:\s*Cruise/, hint: 'Also add: `action brake : Brake;`' },
      { pat: /action\s+brake\s*:\s*Brake/, hint: 'Also add: `action cruise : Cruise;`' },
    ],
    'DriveCycle has all four sub-actions. Next: order them with successions.',
    'Inside DriveCycle { }, add: `action cruise : Cruise;` and `action brake : Brake;`'),
  },

  {
    id: 'l10t6',
    level: 10,
    levelName: 'Actions',
    title: 'Add Successions',
    instruction:
      '**Successions** define execution order using `first ... then ...`\n\n' +
      'Inside **DriveCycle**, add:\n' +
      '`first start then accel;`',
    hint: 'Inside DriveCycle { }, after the action usages, add: `first start then accel;`',
    concept: 'succession (then)',
    conceptExplanation:
      '"first start then accel" means start must complete before accel begins. ' +
      'Successions are directed temporal relationships between action usages.',
    starterCode: `\
action def StartEngine {
}

action def Accelerate {
}

action def Cruise {
}

action def Brake {
}

action def DriveCycle {
    action start : StartEngine;
    action accel : Accelerate;
    action cruise : Cruise;
    action brake : Brake;
}
`,
    targetCode: `\
action def DriveCycle {
    action start : StartEngine;
    action accel : Accelerate;
    action cruise : Cruise;
    action brake : Brake;

    first start then accel;  // <-- NEW
}
`,
    validate: vMatch(
      /first\s+start\s+then\s+accel/,
      'start → accel succession defined! Actions now have temporal order.',
      /first.*then/,
      'Use exact names: `first start then accel;`',
      'Inside DriveCycle { }, add: `first start then accel;`'),
  },

  {
    id: 'l10t7',
    level: 10,
    levelName: 'Actions',
    title: 'Chain Successions',
    instruction:
      'Add the remaining succession chain.\n\n' +
      'Inside **DriveCycle**, add:\n' +
      '- `first accel then cruise;`\n' +
      '- `first cruise then brake;`',
    hint: 'Add both succession lines inside DriveCycle.',
    concept: 'succession chain',
    conceptExplanation:
      'Chained successions define a complete sequence: start → accel → cruise → brake. ' +
      'This is the flow model for the drive cycle behavior.',
    starterCode: `\
action def StartEngine {
}

action def Accelerate {
}

action def Cruise {
}

action def Brake {
}

action def DriveCycle {
    action start : StartEngine;
    action accel : Accelerate;
    action cruise : Cruise;
    action brake : Brake;

    first start then accel;
}
`,
    targetCode: `\
action def DriveCycle {
    // ...actions and first succession...
    first accel then cruise;  // <-- NEW
    first cruise then brake;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /first\s+accel\s+then\s+cruise/, hint: 'Also add: `first cruise then brake;`' },
      { pat: /first\s+cruise\s+then\s+brake/, hint: 'Also add: `first accel then cruise;`' },
    ],
    'Complete sequence: start → accel → cruise → brake.',
    'Inside DriveCycle, add: `first accel then cruise;` and `first cruise then brake;`'),
  },

  {
    id: 'l10t8',
    level: 10,
    levelName: 'Actions',
    title: 'Add a Fork Node',
    instruction:
      'A **fork** splits flow into concurrent branches — parallel execution.\n\n' +
      'Create `action def Launch { }` with:\n' +
      '- `action ignite : Ignite;`\n' +
      '- `action release : Release;`\n' +
      '- `fork forkNode;`\n\n' +
      'Also create `action def Ignite { }` and `action def Release { }`.',
    hint: 'Create the action defs, then inside Launch add usages and `fork forkNode;`',
    concept: 'fork',
    conceptExplanation:
      'Fork nodes split a single flow into multiple concurrent flows. ' +
      'After a fork, all outgoing branches execute in parallel.',
    starterCode: `\
// Spacecraft Launch — Concurrent Behaviors
`,
    targetCode: `\
action def Ignite {
}

action def Release {
}

action def Launch {
    action ignite : Ignite;
    action release : Release;
    fork forkNode;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /action\s+def\s+Ignite\b/, hint: 'Add `action def Release { }` and the Launch action.' },
      { pat: /action\s+def\s+Release\b/, hint: 'Add `action def Ignite { }` and the Launch action.' },
      { pat: /fork\s+forkNode/, hint: 'Add `fork forkNode;` inside Launch.' },
      { pat: /action\s+def\s+Launch\b/, hint: 'Create `action def Launch { }` with action usages and fork.' },
    ],
    'Fork node created! Ignite and Release can execute concurrently.',
    'Create Ignite, Release, and Launch action defs with `fork forkNode;` inside Launch.'),
  },

  {
    id: 'l10t9',
    level: 10,
    levelName: 'Actions',
    title: 'Add a Join Node',
    instruction:
      'A **join** synchronizes concurrent branches back together.\n\n' +
      'Inside **Launch**, add: `join joinNode;`\n\n' +
      'Join waits for all incoming branches to complete before proceeding.',
    hint: 'Inside Launch { }, add: `join joinNode;`',
    concept: 'join',
    conceptExplanation:
      'Join is the complement of fork. Fork splits into parallel paths, ' +
      'join merges them back. No action after the join starts until all branches complete.',
    starterCode: `\
action def Ignite {
}

action def Release {
}

action def Launch {
    action ignite : Ignite;
    action release : Release;
    fork forkNode;
}
`,
    targetCode: `\
action def Launch {
    action ignite : Ignite;
    action release : Release;
    fork forkNode;
    join joinNode;  // <-- NEW
}
`,
    validate: vMatch(
      /join\s+joinNode/,
      'Join node added. Fork splits, join synchronizes — parallel pattern complete.',
      /join/,
      'Name it: `join joinNode;`',
      'Inside Launch { }, add: `join joinNode;`'),
  },

  {
    id: 'l10t10',
    level: 10,
    levelName: 'Actions',
    title: 'Add Decide and Merge',
    instruction:
      'A **decide** selects one branch based on a guard. A **merge** brings alternatives together.\n\n' +
      'Create `action def MissionControl { }` with:\n' +
      '- `action launch : Launch;`\n' +
      '- `action abort : Abort;`\n' +
      '- `decide decideNode;`\n' +
      '- `merge mergeNode;`\n\n' +
      'Also create `action def Abort { }`.',
    hint: 'Create Abort def, then MissionControl with action usages, decide, and merge.',
    concept: 'decide / merge',
    conceptExplanation:
      'Decide selects exactly one branch (exclusive choice). ' +
      'Merge brings alternative branches together. This models conditional behavior.',
    starterCode: `\
action def Ignite {
}

action def Release {
}

action def Launch {
    action ignite : Ignite;
    action release : Release;
    fork forkNode;
    join joinNode;
}
`,
    targetCode: `\
action def Abort {
}

action def MissionControl {
    action launch : Launch;
    action abort : Abort;
    decide decideNode;  // <-- NEW
    merge mergeNode;    // <-- NEW
}
`,
    validate: vAll([
      { pat: /action\s+def\s+MissionControl\b/, hint: 'Add decide and merge nodes inside.' },
      { pat: /decide\s+decideNode/, hint: 'Also add: `merge mergeNode;`' },
      { pat: /merge\s+mergeNode/, hint: 'Also add: `decide decideNode;`' },
      { pat: /action\s+def\s+Abort\b/, hint: 'Also add: `action def Abort { }`' },
    ],
    'Decide/merge pattern complete. Actions fully covered!',
    'Create Abort and MissionControl with decide/merge nodes.'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 11: States & Transitions (8 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l11t1',
    level: 11,
    levelName: 'States',
    title: 'Create a State Definition',
    instruction:
      'A **state def** defines the lifecycle states of a system.\n\n' +
      'State definitions contain state usages and transitions between them.\n\n' +
      'Add `state def VehicleStates { }`',
    hint: 'Type `state def VehicleStates { }` on a new line.',
    concept: '«state def»',
    conceptExplanation:
      'State definitions model the lifecycle of a system as a set of states and transitions. ' +
      'A state machine shows how the system moves between states over time.',
    starterCode: `\
// Vehicle States — Lifecycle Model
// state def defines a state machine.
`,
    targetCode: `\
state def VehicleStates {  // <-- NEW
}
`,
    validate: vDef('state\\s+def', 'VehicleStates',
      'VehicleStates is now a state definition — a state machine blueprint.',
      'Add `state def VehicleStates { }` on a new line.'),
  },

  {
    id: 'l11t2',
    level: 11,
    levelName: 'States',
    title: 'Add States',
    instruction:
      'Inside **VehicleStates**, add three state usages:\n\n' +
      '- `state off;`\n' +
      '- `state idle;`\n' +
      '- `state running;`',
    hint: 'Inside VehicleStates { }, add the three state lines.',
    concept: 'state usage',
    conceptExplanation:
      'State usages define the possible states a system can be in. ' +
      'The vehicle can be off, idle, or running — these are mutually exclusive states.',
    starterCode: `\
state def VehicleStates {
}
`,
    targetCode: `\
state def VehicleStates {
    state off;      // <-- NEW
    state idle;     // <-- NEW
    state running;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /state\s+off\s*;/, hint: 'Also add: `state idle;` and `state running;`' },
      { pat: /state\s+idle\s*;/, hint: 'Also add: `state off;` and `state running;`' },
      { pat: /state\s+running\s*;/, hint: 'Also add: `state off;` and `state idle;`' },
    ],
    'Three states defined: off, idle, running.',
    'Inside VehicleStates { }, add: `state off;`, `state idle;`, `state running;`'),
  },

  {
    id: 'l11t3',
    level: 11,
    levelName: 'States',
    title: 'Add More States',
    instruction:
      'Add two more states to complete the vehicle lifecycle:\n\n' +
      '- `state moving;`\n' +
      '- `state stopped;`',
    hint: 'Inside VehicleStates { }, add both state lines.',
    concept: 'state usage',
    conceptExplanation:
      'A complete state machine covers all possible lifecycle states. ' +
      'Five states: off → idle → running → moving → stopped.',
    starterCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
}
`,
    targetCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;   // <-- NEW
    state stopped;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /state\s+moving\s*;/, hint: 'Also add: `state stopped;`' },
      { pat: /state\s+stopped\s*;/, hint: 'Also add: `state moving;`' },
    ],
    'Five states in the vehicle lifecycle. Next: add transitions.',
    'Inside VehicleStates, add: `state moving;` and `state stopped;`'),
  },

  {
    id: 'l11t4',
    level: 11,
    levelName: 'States',
    title: 'Add First Transition',
    instruction:
      'A **transition** defines a state change.\n\n' +
      'Inside **VehicleStates**, add:\n' +
      '`transition first off then idle;`\n\n' +
      'This means the vehicle goes from off to idle.',
    hint: 'Inside VehicleStates { }, add: `transition first off then idle;`',
    concept: 'transition',
    conceptExplanation:
      '"transition first S1 then S2" defines a directed state change. ' +
      'The system moves from state S1 to state S2 when the transition fires.',
    starterCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;
    state stopped;
}
`,
    targetCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;
    state stopped;

    transition first off then idle;  // <-- NEW
}
`,
    validate: vMatch(
      /transition\s+first\s+off\s+then\s+idle/,
      'Transition: off → idle. The vehicle turns on and enters idle state.',
      /transition.*off/,
      'Use: `transition first off then idle;`',
      'Inside VehicleStates, add: `transition first off then idle;`'),
  },

  {
    id: 'l11t5',
    level: 11,
    levelName: 'States',
    title: 'Add More Transitions',
    instruction:
      'Add two more transitions:\n\n' +
      '- `transition first idle then running;`\n' +
      '- `transition first running then moving;`',
    hint: 'Add both transition lines inside VehicleStates.',
    concept: 'transition chain',
    conceptExplanation:
      'Transitions form a directed graph between states. ' +
      'off → idle → running → moving shows the vehicle startup sequence.',
    starterCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;
    state stopped;

    transition first off then idle;
}
`,
    targetCode: `\
    transition first idle then running;   // <-- NEW
    transition first running then moving; // <-- NEW
`,
    validate: vAll([
      { pat: /transition\s+first\s+idle\s+then\s+running/, hint: 'Also add: `transition first running then moving;`' },
      { pat: /transition\s+first\s+running\s+then\s+moving/, hint: 'Also add: `transition first idle then running;`' },
    ],
    'Transition chain: off → idle → running → moving.',
    'Add both transitions inside VehicleStates.'),
  },

  {
    id: 'l11t6',
    level: 11,
    levelName: 'States',
    title: 'Add Return Transitions',
    instruction:
      'States can transition back to earlier states. Add:\n\n' +
      '- `transition first moving then stopped;`\n' +
      '- `transition first stopped then off;`',
    hint: 'Add both return transition lines.',
    concept: 'bidirectional transitions',
    conceptExplanation:
      'Transitions can form cycles. moving → stopped → off completes the lifecycle. ' +
      'The full graph: off → idle → running → moving → stopped → off.',
    starterCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;
    state stopped;

    transition first off then idle;
    transition first idle then running;
    transition first running then moving;
}
`,
    targetCode: `\
    transition first moving then stopped; // <-- NEW
    transition first stopped then off;    // <-- NEW
`,
    validate: vAll([
      { pat: /transition\s+first\s+moving\s+then\s+stopped/, hint: 'Also add: `transition first stopped then off;`' },
      { pat: /transition\s+first\s+stopped\s+then\s+off/, hint: 'Also add: `transition first moving then stopped;`' },
    ],
    'Full lifecycle: off → idle → running → moving → stopped → off.',
    'Add: `transition first moving then stopped;` and `transition first stopped then off;`'),
  },

  {
    id: 'l11t7',
    level: 11,
    levelName: 'States',
    title: 'Create a Separate State Machine',
    instruction:
      'Create a new state machine for a traffic light.\n\n' +
      'Add `state def TrafficLightStates { }` with:\n' +
      '- `state red;`\n' +
      '- `state yellow;`\n' +
      '- `state green;`',
    hint: 'Add the state def with three state usages inside.',
    concept: '«state def»',
    conceptExplanation:
      'Each system or subsystem can have its own state machine. ' +
      'Traffic lights have a simple cyclic state model: red → green → yellow → red.',
    starterCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;
    state stopped;

    transition first off then idle;
    transition first idle then running;
    transition first running then moving;
    transition first moving then stopped;
    transition first stopped then off;
}
`,
    targetCode: `\
state def TrafficLightStates {
    state red;     // <-- NEW
    state yellow;  // <-- NEW
    state green;   // <-- NEW
}
`,
    validate: vAll([
      { pat: /state\s+def\s+TrafficLightStates\b/, hint: 'Add state usages inside.' },
      { pat: /state\s+red\s*;/, hint: 'Also add yellow and green states.' },
      { pat: /state\s+yellow\s*;/, hint: 'Also add red and green states.' },
      { pat: /state\s+green\s*;/, hint: 'Also add red and yellow states.' },
    ],
    'TrafficLightStates defined with red, yellow, green states.',
    'Add `state def TrafficLightStates { }` with red, yellow, green states.'),
  },

  {
    id: 'l11t8',
    level: 11,
    levelName: 'States',
    title: 'Complete the Traffic Light Cycle',
    instruction:
      'Add cyclic transitions for the traffic light:\n\n' +
      '- `transition first red then green;`\n' +
      '- `transition first green then yellow;`\n' +
      '- `transition first yellow then red;`',
    hint: 'Add all three transitions inside TrafficLightStates.',
    concept: 'cyclic transitions',
    conceptExplanation:
      'Cyclic state machines loop forever: red → green → yellow → red → ... ' +
      'This is the standard traffic light pattern. States mastered!',
    starterCode: `\
state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;
    state stopped;

    transition first off then idle;
    transition first idle then running;
    transition first running then moving;
    transition first moving then stopped;
    transition first stopped then off;
}

state def TrafficLightStates {
    state red;
    state yellow;
    state green;
}
`,
    targetCode: `\
state def TrafficLightStates {
    state red;
    state yellow;
    state green;

    transition first red then green;     // <-- NEW
    transition first green then yellow;  // <-- NEW
    transition first yellow then red;    // <-- NEW
}
`,
    validate: vAll([
      { pat: /transition\s+first\s+red\s+then\s+green/, hint: 'Also add green→yellow and yellow→red transitions.' },
      { pat: /transition\s+first\s+green\s+then\s+yellow/, hint: 'Also add red→green and yellow→red transitions.' },
      { pat: /transition\s+first\s+yellow\s+then\s+red/, hint: 'Also add red→green and green→yellow transitions.' },
    ],
    'Traffic light cycle complete: red → green → yellow → red. States mastered!',
    'Add all three cyclic transitions inside TrafficLightStates.'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 12: Requirements (8 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l12t1',
    level: 12,
    levelName: 'Requirements',
    title: 'Create a Requirement Definition',
    instruction:
      'A **requirement def** captures a condition that the system must satisfy.\n\n' +
      'Add `requirement def MassRequirement { }`',
    hint: 'Type `requirement def MassRequirement { }` on a new line.',
    concept: '«requirement def»',
    conceptExplanation:
      'Requirements formalize what the system must do or be. ' +
      'They can include documentation text, a subject, and relationships to design elements.',
    starterCode: `\
// Vehicle Requirements Model
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}
`,
    targetCode: `\
requirement def MassRequirement {  // <-- NEW
}
`,
    validate: vDef('requirement\\s+def', 'MassRequirement',
      'MassRequirement defined — a formal requirement type.',
      'Add `requirement def MassRequirement { }` to the model.'),
  },

  {
    id: 'l12t2',
    level: 12,
    levelName: 'Requirements',
    title: 'Add Documentation to Requirement',
    instruction:
      'Requirements should have documentation text.\n\n' +
      'Inside **MassRequirement**, add:\n' +
      '`doc /* The vehicle mass shall not exceed 2000 kg. */`',
    hint: 'Inside MassRequirement { }, add the doc line.',
    concept: 'doc comment',
    conceptExplanation:
      '"doc /* text */" adds formal documentation to a model element. ' +
      'This is the requirement text — the condition that must be met.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}

requirement def MassRequirement {
}
`,
    targetCode: `\
requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */  // <-- NEW
}
`,
    validate: vMatch(
      /doc\s+\/\*.*mass.*\*\//i,
      'MassRequirement now has formal documentation text.',
      /doc/,
      'Add: `doc /* The vehicle mass shall not exceed 2000 kg. */`',
      'Inside MassRequirement { }, add: `doc /* The vehicle mass shall not exceed 2000 kg. */`'),
  },

  {
    id: 'l12t3',
    level: 12,
    levelName: 'Requirements',
    title: 'Create More Requirements',
    instruction:
      'Add two more requirement definitions:\n\n' +
      '- `requirement def SpeedRequirement { }`\n' +
      '- `requirement def SafetyRequirement { }`',
    hint: 'Add both requirement definitions on new lines.',
    concept: '«requirement def»',
    conceptExplanation:
      'A system typically has many requirements covering performance, safety, cost, ' +
      'reliability, and other quality attributes.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}

requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
}
`,
    targetCode: `\
requirement def SpeedRequirement {  // <-- NEW
}

requirement def SafetyRequirement {  // <-- NEW
}
`,
    validate: vAll([
      { pat: /requirement\s+def\s+SpeedRequirement\b/, hint: 'Also add: `requirement def SafetyRequirement { }`' },
      { pat: /requirement\s+def\s+SafetyRequirement\b/, hint: 'Also add: `requirement def SpeedRequirement { }`' },
    ],
    'Three requirements: mass, speed, and safety.',
    'Add `requirement def SpeedRequirement { }` and `requirement def SafetyRequirement { }`'),
  },

  {
    id: 'l12t4',
    level: 12,
    levelName: 'Requirements',
    title: 'Add Documentation to Speed Requirement',
    instruction:
      'Add documentation to SpeedRequirement:\n\n' +
      '`doc /* The vehicle shall achieve a top speed of at least 200 km/h. */`',
    hint: 'Inside SpeedRequirement { }, add the doc line.',
    concept: 'requirement text',
    conceptExplanation:
      'Each requirement should have clear, testable documentation. ' +
      'The "shall" keyword is standard for requirements text (IEEE 830 convention).',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}

requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
}

requirement def SpeedRequirement {
}

requirement def SafetyRequirement {
}
`,
    targetCode: `\
requirement def SpeedRequirement {
    doc /* The vehicle shall achieve a top speed of at least 200 km/h. */  // <-- NEW
}
`,
    validate: vMatch(
      /doc\s+\/\*.*speed.*\*\//i,
      'SpeedRequirement has its formal text. Clear, testable requirement.',
      /doc.*SpeedRequirement|SpeedRequirement.*doc/,
      'Add `doc /* ... */` inside SpeedRequirement.',
      'Inside SpeedRequirement { }, add a doc comment about speed.'),
  },

  {
    id: 'l12t5',
    level: 12,
    levelName: 'Requirements',
    title: 'Satisfy a Requirement',
    instruction:
      'The **satisfy** relationship asserts that a design element meets a requirement.\n\n' +
      'Add: `satisfy MassRequirement by Vehicle;`',
    hint: 'Type `satisfy MassRequirement by Vehicle;` on a new line.',
    concept: 'satisfy',
    conceptExplanation:
      '"satisfy R by X" asserts that design element X satisfies requirement R. ' +
      'This creates traceability between requirements and the design.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}

requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
}

requirement def SpeedRequirement {
    doc /* The vehicle shall achieve a top speed of at least 200 km/h. */
}

requirement def SafetyRequirement {
}
`,
    targetCode: `\
// Traceability:
satisfy MassRequirement by Vehicle;  // <-- NEW
`,
    validate: vMatch(
      /satisfy\s+MassRequirement\s+by\s+Vehicle/,
      'Vehicle satisfies MassRequirement. Traceability established!',
      /satisfy.*Mass/i,
      'Use: `satisfy MassRequirement by Vehicle;`',
      'Add `satisfy MassRequirement by Vehicle;` on a new line.'),
  },

  {
    id: 'l12t6',
    level: 12,
    levelName: 'Requirements',
    title: 'Satisfy Another Requirement',
    instruction:
      'Add another satisfy relationship:\n\n' +
      '`satisfy SpeedRequirement by Vehicle;`',
    hint: 'Type `satisfy SpeedRequirement by Vehicle;` on a new line.',
    concept: 'satisfy',
    conceptExplanation:
      'A single design element can satisfy multiple requirements. ' +
      'Vehicle satisfies both mass and speed requirements.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}

requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
}

requirement def SpeedRequirement {
    doc /* The vehicle shall achieve a top speed of at least 200 km/h. */
}

requirement def SafetyRequirement {
}

satisfy MassRequirement by Vehicle;
`,
    targetCode: `\
satisfy SpeedRequirement by Vehicle;  // <-- NEW
`,
    validate: vMatch(
      /satisfy\s+SpeedRequirement\s+by\s+Vehicle/,
      'Vehicle satisfies both MassRequirement and SpeedRequirement.',
      /satisfy.*Speed/i,
      'Use: `satisfy SpeedRequirement by Vehicle;`',
      'Add `satisfy SpeedRequirement by Vehicle;` on a new line.'),
  },

  {
    id: 'l12t7',
    level: 12,
    levelName: 'Requirements',
    title: 'Verify a Requirement',
    instruction:
      'The **verify** relationship asserts that a test case verifies a requirement.\n\n' +
      'First add `part def MassTest { }`, then add:\n' +
      '`verify MassRequirement by MassTest;`',
    hint: 'Add `part def MassTest { }` then `verify MassRequirement by MassTest;`',
    concept: 'verify',
    conceptExplanation:
      '"verify R by T" asserts that test T verifies requirement R. ' +
      'Satisfy links design to requirements; verify links tests to requirements.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}

requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
}

requirement def SpeedRequirement {
    doc /* The vehicle shall achieve a top speed of at least 200 km/h. */
}

satisfy MassRequirement by Vehicle;
satisfy SpeedRequirement by Vehicle;
`,
    targetCode: `\
part def MassTest {  // <-- NEW
}

verify MassRequirement by MassTest;  // <-- NEW
`,
    validate: vAll([
      { pat: /part\s+def\s+MassTest\b/, hint: 'Now add: `verify MassRequirement by MassTest;`' },
      { pat: /verify\s+MassRequirement\s+by\s+MassTest/, hint: 'Also add: `part def MassTest { }`' },
    ],
    'MassTest verifies MassRequirement. Full traceability: design ← requirement → test.',
    'Add `part def MassTest { }` and `verify MassRequirement by MassTest;`'),
  },

  {
    id: 'l12t8',
    level: 12,
    levelName: 'Requirements',
    title: 'Create a Requirement Hierarchy',
    instruction:
      'Requirements can specialize other requirements.\n\n' +
      'Add `requirement def BrakingDistance :> SafetyRequirement { }` with documentation:\n' +
      '`doc /* Braking distance shall be less than 40m from 100 km/h. */`',
    hint: 'Add the specialized requirement with doc text inside.',
    concept: 'requirement specialization',
    conceptExplanation:
      'Requirement specialization creates a hierarchy. BrakingDistance :> SafetyRequirement ' +
      'means BrakingDistance is a specific safety requirement. Requirements mastered!',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
    attribute totalMass : Real;
}

requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
}

requirement def SpeedRequirement {
    doc /* The vehicle shall achieve a top speed of at least 200 km/h. */
}

requirement def SafetyRequirement {
}

satisfy MassRequirement by Vehicle;
satisfy SpeedRequirement by Vehicle;
`,
    targetCode: `\
requirement def BrakingDistance :> SafetyRequirement {
    doc /* Braking distance shall be less than 40m from 100 km/h. */  // <-- NEW
}
`,
    validate: vAll([
      { pat: /requirement\s+def\s+BrakingDistance\s*:>\s*SafetyRequirement/, hint: 'Add doc text inside.' },
      { pat: /doc\s+\/\*.*[Bb]rak.*\*\//, hint: 'Also specialize SafetyRequirement: `:> SafetyRequirement`' },
    ],
    'BrakingDistance specializes SafetyRequirement. Requirement hierarchy established!',
    'Add `requirement def BrakingDistance :> SafetyRequirement { }` with doc text.'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 13: Constraints & Calculations (7 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l13t1',
    level: 13,
    levelName: 'Constraints & Calculations',
    title: 'Create a Constraint Definition',
    instruction:
      'A **constraint def** defines a boolean condition that must hold true.\n\n' +
      'Add `constraint def MassLimit { }`',
    hint: 'Type `constraint def MassLimit { }` on a new line.',
    concept: '«constraint def»',
    conceptExplanation:
      'Constraints are predicates — boolean expressions that constrain the system. ' +
      'They formalize rules like "total mass must be under 2000 kg".',
    starterCode: `\
// Vehicle Constraints Model
part def Vehicle {
    attribute totalMass : Real;
    attribute maxSpeed : Real;
}
`,
    targetCode: `\
constraint def MassLimit {  // <-- NEW
}
`,
    validate: vDef('constraint\\s+def', 'MassLimit',
      'MassLimit is a constraint definition — a boolean predicate.',
      'Add `constraint def MassLimit { }` to the model.'),
  },

  {
    id: 'l13t2',
    level: 13,
    levelName: 'Constraints & Calculations',
    title: 'Add Constraint Parameters',
    instruction:
      'Constraints have parameters that they evaluate.\n\n' +
      'Inside **MassLimit**, add:\n' +
      '`in attribute mass : Real;`',
    hint: 'Inside MassLimit { }, add: `in attribute mass : Real;`',
    concept: 'constraint parameters',
    conceptExplanation:
      'Constraint parameters are the values being checked. ' +
      '"in attribute mass : Real" means MassLimit takes a mass value and checks it.',
    starterCode: `\
part def Vehicle {
    attribute totalMass : Real;
    attribute maxSpeed : Real;
}

constraint def MassLimit {
}
`,
    targetCode: `\
constraint def MassLimit {
    in attribute mass : Real;  // <-- NEW
}
`,
    validate: vMatch(
      /in\s+attribute\s+mass\s*:\s*Real/,
      'MassLimit has a mass input parameter to evaluate.',
      /mass/,
      'Use: `in attribute mass : Real;`',
      'Inside MassLimit { }, add: `in attribute mass : Real;`'),
  },

  {
    id: 'l13t3',
    level: 13,
    levelName: 'Constraints & Calculations',
    title: 'Create a Calculation Definition',
    instruction:
      'A **calc def** defines a computation with typed parameters.\n\n' +
      'Add `calc def TotalMass { }`',
    hint: 'Type `calc def TotalMass { }` on a new line.',
    concept: '«calc def»',
    conceptExplanation:
      'Calculations compute values from inputs. Unlike constraints (boolean predicates), ' +
      'calculations produce a typed result — a computed value.',
    starterCode: `\
part def Vehicle {
    attribute totalMass : Real;
    attribute maxSpeed : Real;
}

constraint def MassLimit {
    in attribute mass : Real;
}
`,
    targetCode: `\
calc def TotalMass {  // <-- NEW
}
`,
    validate: vDef('calc\\s+def', 'TotalMass',
      'TotalMass is a calculation definition — computes a value.',
      'Add `calc def TotalMass { }` to the model.'),
  },

  {
    id: 'l13t4',
    level: 13,
    levelName: 'Constraints & Calculations',
    title: 'Add Calc Parameters',
    instruction:
      'Add input and output parameters to TotalMass:\n\n' +
      '- `in attribute bodyMass : Real;`\n' +
      '- `in attribute cargoMass : Real;`\n' +
      '- `out attribute result : Real;`',
    hint: 'Inside TotalMass { }, add all three parameter lines.',
    concept: 'calc parameters',
    conceptExplanation:
      'Calculations take inputs and produce outputs. ' +
      'TotalMass takes bodyMass and cargoMass as inputs and produces a result.',
    starterCode: `\
part def Vehicle {
    attribute totalMass : Real;
    attribute maxSpeed : Real;
}

constraint def MassLimit {
    in attribute mass : Real;
}

calc def TotalMass {
}
`,
    targetCode: `\
calc def TotalMass {
    in attribute bodyMass : Real;   // <-- NEW
    in attribute cargoMass : Real;  // <-- NEW
    out attribute result : Real;    // <-- NEW
}
`,
    validate: vAll([
      { pat: /in\s+attribute\s+bodyMass\s*:\s*Real/, hint: 'Also add cargoMass and result parameters.' },
      { pat: /in\s+attribute\s+cargoMass\s*:\s*Real/, hint: 'Also add bodyMass and result parameters.' },
      { pat: /out\s+attribute\s+result\s*:\s*Real/, hint: 'Also add bodyMass and cargoMass parameters.' },
    ],
    'TotalMass takes bodyMass + cargoMass and produces a result.',
    'Inside TotalMass, add two "in" parameters and one "out" parameter.'),
  },

  {
    id: 'l13t5',
    level: 13,
    levelName: 'Constraints & Calculations',
    title: 'Create Another Constraint',
    instruction:
      'Create a speed constraint:\n\n' +
      '`constraint def SpeedLimit { }` with `in attribute speed : Real;` inside.',
    hint: 'Add the constraint def with the in parameter.',
    concept: '«constraint def»',
    conceptExplanation:
      'Multiple constraints can govern different aspects of the system. ' +
      'MassLimit constrains mass, SpeedLimit constrains speed.',
    starterCode: `\
part def Vehicle {
    attribute totalMass : Real;
    attribute maxSpeed : Real;
}

constraint def MassLimit {
    in attribute mass : Real;
}

calc def TotalMass {
    in attribute bodyMass : Real;
    in attribute cargoMass : Real;
    out attribute result : Real;
}
`,
    targetCode: `\
constraint def SpeedLimit {
    in attribute speed : Real;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /constraint\s+def\s+SpeedLimit\b/, hint: 'Add `in attribute speed : Real;` inside.' },
      { pat: /in\s+attribute\s+speed\s*:\s*Real/, hint: 'Also add `constraint def SpeedLimit { }`.' },
    ],
    'SpeedLimit constraint defined with a speed parameter.',
    'Add `constraint def SpeedLimit { in attribute speed : Real; }`'),
  },

  {
    id: 'l13t6',
    level: 13,
    levelName: 'Constraints & Calculations',
    title: 'Create a Safety Factor Calc',
    instruction:
      'Create a calculation for safety factor:\n\n' +
      '`calc def SafetyFactor { }` with:\n' +
      '- `in attribute loadCapacity : Real;`\n' +
      '- `in attribute actualLoad : Real;`\n' +
      '- `out attribute factor : Real;`',
    hint: 'Add the calc def with all three parameters.',
    concept: '«calc def»',
    conceptExplanation:
      'SafetyFactor computes loadCapacity / actualLoad. ' +
      'Calculations model the mathematical relationships in your system.',
    starterCode: `\
part def Vehicle {
    attribute totalMass : Real;
    attribute maxSpeed : Real;
}

constraint def MassLimit {
    in attribute mass : Real;
}

constraint def SpeedLimit {
    in attribute speed : Real;
}

calc def TotalMass {
    in attribute bodyMass : Real;
    in attribute cargoMass : Real;
    out attribute result : Real;
}
`,
    targetCode: `\
calc def SafetyFactor {
    in attribute loadCapacity : Real;  // <-- NEW
    in attribute actualLoad : Real;    // <-- NEW
    out attribute factor : Real;       // <-- NEW
}
`,
    validate: vAll([
      { pat: /calc\s+def\s+SafetyFactor\b/, hint: 'Add parameters inside SafetyFactor.' },
      { pat: /in\s+attribute\s+loadCapacity\s*:\s*Real/, hint: 'Also add actualLoad and factor.' },
      { pat: /in\s+attribute\s+actualLoad\s*:\s*Real/, hint: 'Also add loadCapacity and factor.' },
      { pat: /out\s+attribute\s+factor\s*:\s*Real/, hint: 'Also add loadCapacity and actualLoad.' },
    ],
    'SafetyFactor calculation defined with proper in/out parameters.',
    'Add `calc def SafetyFactor { }` with in/out parameters.'),
  },

  {
    id: 'l13t7',
    level: 13,
    levelName: 'Constraints & Calculations',
    title: 'Specialize a Constraint',
    instruction:
      'Constraints can specialize other constraints.\n\n' +
      'Add `constraint def EmergencyMassLimit :> MassLimit { }`',
    hint: 'Type `constraint def EmergencyMassLimit :> MassLimit { }` on a new line.',
    concept: 'constraint specialization',
    conceptExplanation:
      'EmergencyMassLimit :> MassLimit is a stricter mass constraint. ' +
      'Specialization works on all definition types — parts, constraints, calcs, etc.',
    starterCode: `\
part def Vehicle {
    attribute totalMass : Real;
    attribute maxSpeed : Real;
}

constraint def MassLimit {
    in attribute mass : Real;
}

constraint def SpeedLimit {
    in attribute speed : Real;
}

calc def TotalMass {
    in attribute bodyMass : Real;
    in attribute cargoMass : Real;
    out attribute result : Real;
}

calc def SafetyFactor {
    in attribute loadCapacity : Real;
    in attribute actualLoad : Real;
    out attribute factor : Real;
}
`,
    targetCode: `\
constraint def EmergencyMassLimit :> MassLimit {  // <-- NEW
}
`,
    validate: vSpec('constraint\\s+def', 'EmergencyMassLimit', 'MassLimit',
      'EmergencyMassLimit specializes MassLimit. Constraints & calculations mastered!',
      'Add `constraint def EmergencyMassLimit :> MassLimit { }` on a new line.'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 14: Packages & Imports (6 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l14t1',
    level: 14,
    levelName: 'Packages & Imports',
    title: 'Create a Package',
    instruction:
      'A **package** is a namespace that groups related definitions.\n\n' +
      'Add `package VehicleDomain { }` and put a `part def Vehicle { }` inside it.',
    hint: 'Type `package VehicleDomain { part def Vehicle { } }`',
    concept: 'package',
    conceptExplanation:
      'Packages organize models into namespaces. Elements inside a package are scoped ' +
      'to that package. Import makes elements from other packages visible.',
    starterCode: `\
// System Architecture — Packages
`,
    targetCode: `\
package VehicleDomain {
    part def Vehicle {  // <-- NEW
    }
}
`,
    validate: vAll([
      { pat: /package\s+VehicleDomain\b/, hint: 'Put `part def Vehicle { }` inside the package.' },
      { pat: /part\s+def\s+Vehicle\b/, hint: 'Also wrap it in `package VehicleDomain { }`.' },
    ],
    'VehicleDomain package created with Vehicle inside. Elements are now namespaced.',
    'Add `package VehicleDomain { part def Vehicle { } }`'),
  },

  {
    id: 'l14t2',
    level: 14,
    levelName: 'Packages & Imports',
    title: 'Add More Definitions to Package',
    instruction:
      'Add `part def Engine { }` and `part def Wheel { }` inside **VehicleDomain**.',
    hint: 'Inside package VehicleDomain { }, add both part definitions.',
    concept: 'package contents',
    conceptExplanation:
      'A package can contain any number of definitions. ' +
      'All elements inside VehicleDomain have the namespace VehicleDomain::.',
    starterCode: `\
package VehicleDomain {
    part def Vehicle {
    }
}
`,
    targetCode: `\
package VehicleDomain {
    part def Vehicle {
    }

    part def Engine {  // <-- NEW
    }

    part def Wheel {  // <-- NEW
    }
}
`,
    validate: vAll([
      { pat: /part\s+def\s+Engine\b/, hint: 'Also add: `part def Wheel { }`' },
      { pat: /part\s+def\s+Wheel\b/, hint: 'Also add: `part def Engine { }`' },
    ],
    'VehicleDomain now contains Vehicle, Engine, and Wheel.',
    'Inside VehicleDomain, add `part def Engine { }` and `part def Wheel { }`'),
  },

  {
    id: 'l14t3',
    level: 14,
    levelName: 'Packages & Imports',
    title: 'Create a Second Package',
    instruction:
      'Create another package for requirements:\n\n' +
      '`package Requirements { }` with `requirement def MassReq { }` inside.',
    hint: 'Add `package Requirements { requirement def MassReq { } }`',
    concept: 'multiple packages',
    conceptExplanation:
      'Separate packages for different concerns: VehicleDomain for structure, ' +
      'Requirements for requirements. This is good model organization practice.',
    starterCode: `\
package VehicleDomain {
    part def Vehicle {
    }

    part def Engine {
    }

    part def Wheel {
    }
}
`,
    targetCode: `\
package Requirements {
    requirement def MassReq {  // <-- NEW
    }
}
`,
    validate: vAll([
      { pat: /package\s+Requirements\b/, hint: 'Add `requirement def MassReq { }` inside.' },
      { pat: /requirement\s+def\s+MassReq\b/, hint: 'Also wrap it in `package Requirements { }`.' },
    ],
    'Two packages: VehicleDomain (structure) and Requirements (requirements).',
    'Add `package Requirements { requirement def MassReq { } }`'),
  },

  {
    id: 'l14t4',
    level: 14,
    levelName: 'Packages & Imports',
    title: 'Use Import',
    instruction:
      'The **import** statement makes elements from another package visible.\n\n' +
      'Inside **Requirements**, add:\n' +
      '`import VehicleDomain::*;`\n\n' +
      'This imports all elements from VehicleDomain.',
    hint: 'Inside Requirements { }, add: `import VehicleDomain::*;`',
    concept: 'import',
    conceptExplanation:
      '`import PackageName::*` imports all public members. ' +
      '`import PackageName::TypeName` imports a specific element. ' +
      'Without import, you must use the fully qualified name.',
    starterCode: `\
package VehicleDomain {
    part def Vehicle {
    }

    part def Engine {
    }

    part def Wheel {
    }
}

package Requirements {
    requirement def MassReq {
    }
}
`,
    targetCode: `\
package Requirements {
    import VehicleDomain::*;  // <-- NEW

    requirement def MassReq {
    }
}
`,
    validate: vMatch(
      /import\s+VehicleDomain::\*/,
      'Requirements can now reference Vehicle, Engine, Wheel directly.',
      /import.*VehicleDomain/,
      'Use: `import VehicleDomain::*;` for wildcard import.',
      'Inside Requirements { }, add: `import VehicleDomain::*;`'),
  },

  {
    id: 'l14t5',
    level: 14,
    levelName: 'Packages & Imports',
    title: 'Create Nested Packages',
    instruction:
      'Packages can be nested. Inside **VehicleDomain**, add:\n\n' +
      '`package Powertrain { }` with `part def Turbo { }` inside.',
    hint: 'Inside VehicleDomain, add: `package Powertrain { part def Turbo { } }`',
    concept: 'nested packages',
    conceptExplanation:
      'Nested packages create deeper namespaces: VehicleDomain::Powertrain::Turbo. ' +
      'This helps organize large models into logical groups.',
    starterCode: `\
package VehicleDomain {
    part def Vehicle {
    }

    part def Engine {
    }

    part def Wheel {
    }
}

package Requirements {
    import VehicleDomain::*;

    requirement def MassReq {
    }
}
`,
    targetCode: `\
package VehicleDomain {
    // ...existing defs...

    package Powertrain {
        part def Turbo {  // <-- NEW
        }
    }
}
`,
    validate: vAll([
      { pat: /package\s+Powertrain\b/, hint: 'Add `part def Turbo { }` inside Powertrain.' },
      { pat: /part\s+def\s+Turbo\b/, hint: 'Also wrap it in `package Powertrain { }`.' },
    ],
    'Nested package: VehicleDomain::Powertrain::Turbo. Model well-organized!',
    'Inside VehicleDomain, add: `package Powertrain { part def Turbo { } }`'),
  },

  {
    id: 'l14t6',
    level: 14,
    levelName: 'Packages & Imports',
    title: 'Specific Import',
    instruction:
      'Import a specific element instead of wildcard.\n\n' +
      'Inside a new `package Testing { }`, add:\n' +
      '`import VehicleDomain::Vehicle;`\n\n' +
      'This imports only Vehicle, not Engine or Wheel.',
    hint: 'Add `package Testing { import VehicleDomain::Vehicle; }`',
    concept: 'specific import',
    conceptExplanation:
      'Specific imports are more precise: `import Pkg::Name` imports only that element. ' +
      'Wildcard `::*` is convenient but can cause name conflicts in large models.',
    starterCode: `\
package VehicleDomain {
    part def Vehicle {
    }

    part def Engine {
    }

    part def Wheel {
    }

    package Powertrain {
        part def Turbo {
        }
    }
}

package Requirements {
    import VehicleDomain::*;

    requirement def MassReq {
    }
}
`,
    targetCode: `\
package Testing {
    import VehicleDomain::Vehicle;  // <-- NEW
}
`,
    validate: vAll([
      { pat: /package\s+Testing\b/, hint: 'Add `import VehicleDomain::Vehicle;` inside.' },
      { pat: /import\s+VehicleDomain::Vehicle\s*;/, hint: 'Also wrap it in `package Testing { }`.' },
    ],
    'Specific import: only Vehicle is visible in Testing. Packages mastered!',
    'Add `package Testing { import VehicleDomain::Vehicle; }`'),
  },

  // ════════════════════════════════════════════════════════════════════════════
  // LEVEL 15: Use Cases, Allocation & Views (6 tasks)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'l15t1',
    level: 15,
    levelName: 'Advanced Concepts',
    title: 'Create a Use Case Definition',
    instruction:
      'A **use case def** describes a scenario of system usage.\n\n' +
      'Add `use case def DriveToWork { }`',
    hint: 'Type `use case def DriveToWork { }` on a new line.',
    concept: '«use case def»',
    conceptExplanation:
      'Use case definitions capture how actors interact with the system. ' +
      'They describe the system from the user\'s perspective — what the system does for them.',
    starterCode: `\
// System Usage & Allocation Model
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Driver {
}
`,
    targetCode: `\
use case def DriveToWork {  // <-- NEW
}
`,
    validate: vDef('use\\s+case\\s+def', 'DriveToWork',
      'DriveToWork is a use case definition — a usage scenario.',
      'Add `use case def DriveToWork { }` to the model.'),
  },

  {
    id: 'l15t2',
    level: 15,
    levelName: 'Advanced Concepts',
    title: 'Create Another Use Case',
    instruction:
      'Add a second use case for highway driving:\n\n' +
      '`use case def HighwayDrive { }`',
    hint: 'Type `use case def HighwayDrive { }` on a new line.',
    concept: '«use case def»',
    conceptExplanation:
      'Multiple use cases describe different scenarios. ' +
      'DriveToWork and HighwayDrive represent different usage contexts for the vehicle.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Driver {
}

use case def DriveToWork {
}
`,
    targetCode: `\
use case def HighwayDrive {  // <-- NEW
}
`,
    validate: vDef('use\\s+case\\s+def', 'HighwayDrive',
      'Two use cases: DriveToWork and HighwayDrive.',
      'Add `use case def HighwayDrive { }` to the model.'),
  },

  {
    id: 'l15t3',
    level: 15,
    levelName: 'Advanced Concepts',
    title: 'Use Allocate',
    instruction:
      'The **allocate** relationship maps logical elements to physical ones.\n\n' +
      'Add: `allocate DriveToWork to Vehicle;`',
    hint: 'Type `allocate DriveToWork to Vehicle;` on a new line.',
    concept: 'allocate',
    conceptExplanation:
      '"allocate A to B" maps element A to element B across domains. ' +
      'This connects requirements/behaviors to physical structure.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Driver {
}

use case def DriveToWork {
}

use case def HighwayDrive {
}
`,
    targetCode: `\
allocate DriveToWork to Vehicle;  // <-- NEW
`,
    validate: vMatch(
      /allocate\s+DriveToWork\s+to\s+Vehicle/,
      'DriveToWork allocated to Vehicle. Cross-domain traceability!',
      /allocate.*DriveToWork/,
      'Use: `allocate DriveToWork to Vehicle;`',
      'Add `allocate DriveToWork to Vehicle;` on a new line.'),
  },

  {
    id: 'l15t4',
    level: 15,
    levelName: 'Advanced Concepts',
    title: 'Create a Viewpoint Definition',
    instruction:
      'A **viewpoint def** defines a stakeholder perspective.\n\n' +
      'Add `viewpoint def EngineerView { }`',
    hint: 'Type `viewpoint def EngineerView { }` on a new line.',
    concept: '«viewpoint def»',
    conceptExplanation:
      'Viewpoints define what a stakeholder cares about — their concerns. ' +
      'Different stakeholders (engineer, manager, safety analyst) have different viewpoints.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Driver {
}

use case def DriveToWork {
}

allocate DriveToWork to Vehicle;
`,
    targetCode: `\
viewpoint def EngineerView {  // <-- NEW
}
`,
    validate: vDef('viewpoint\\s+def', 'EngineerView',
      'EngineerView viewpoint defined — an engineer\'s perspective on the model.',
      'Add `viewpoint def EngineerView { }` to the model.'),
  },

  {
    id: 'l15t5',
    level: 15,
    levelName: 'Advanced Concepts',
    title: 'Create a View Definition',
    instruction:
      'A **view def** renders model content for a specific viewpoint.\n\n' +
      'Add `view def SystemOverview { }`',
    hint: 'Type `view def SystemOverview { }` on a new line.',
    concept: '«view def»',
    conceptExplanation:
      'A view selects and presents model elements according to a viewpoint\'s concerns. ' +
      'Views are the "lenses" through which stakeholders see the model.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Driver {
}

use case def DriveToWork {
}

allocate DriveToWork to Vehicle;

viewpoint def EngineerView {
}
`,
    targetCode: `\
view def SystemOverview {  // <-- NEW
}
`,
    validate: vDef('view\\s+def', 'SystemOverview',
      'SystemOverview view defined. Views present the model to stakeholders.',
      'Add `view def SystemOverview { }` to the model.'),
  },

  {
    id: 'l15t6',
    level: 15,
    levelName: 'Advanced Concepts',
    title: 'Complete the Model',
    instruction:
      'Bring it all together! Create a concern definition and a rendering definition:\n\n' +
      '- `concern def Performance { }`\n' +
      '- `rendering def DiagramView { }`\n\n' +
      'These are the final SysML v2 element types.',
    hint: 'Add both definitions on new lines.',
    concept: 'concern & rendering',
    conceptExplanation:
      'Concerns define what matters to stakeholders. Renderings define how views are displayed. ' +
      'Together with viewpoints and views, they complete the presentation model.',
    starterCode: `\
part def Vehicle {
    attribute maxSpeed : Real;
}

part def Driver {
}

use case def DriveToWork {
}

allocate DriveToWork to Vehicle;

viewpoint def EngineerView {
}

view def SystemOverview {
}
`,
    targetCode: `\
concern def Performance {  // <-- NEW
}

rendering def DiagramView {  // <-- NEW
}
`,
    validate: vAll([
      { pat: /concern\s+def\s+Performance\b/, hint: 'Also add: `rendering def DiagramView { }`' },
      { pat: /rendering\s+def\s+DiagramView\b/, hint: 'Also add: `concern def Performance { }`' },
    ],
    'Congratulations! You\'ve completed all 100 training tasks covering the full SysML v2 language!',
    'Add `concern def Performance { }` and `rendering def DiagramView { }`'),
  },
];

export const TOTAL_LEVELS = 15;

export const COMPLETED_CODE = `\
// SysML v2 Training Complete!
// You have mastered:
// - Part definitions & usages
// - Attributes (Real, Integer, Boolean, String)
// - Specialization (:>)
// - Composition & multiplicity
// - Subsetting (:> on usages)
// - Redefinition (:>>)
// - Ports & directed features (in, out, inout)
// - Items & connections
// - Enumerations
// - Actions, successions, fork/join, decide/merge
// - States & transitions
// - Requirements, satisfy, verify
// - Constraints & calculations
// - Packages & imports
// - Use cases, allocation, views & viewpoints

part def Vehicle {
    attribute maxSpeed : Real;
    attribute color : Color;
    part eng : Engine;
    part wheel[4] : Wheel;
    port fuelPort : FuelPort;
}

part def Engine {
    attribute mass : Real;
    attribute horsepower : Real;
    attribute fuelType : FuelType;
    port engineFuel : FuelPort;
}

part def Wheel {
    attribute diameter : Real;
}

part def PoweredVehicle :> Vehicle {
    part frontWheel :> wheel;
    part rearWheel :> wheel;
}

port def FuelPort {
    in attribute fuelIn : Real;
    out attribute exhaustOut : Real;
}

item def Fuel {
    attribute octaneRating : Integer;
}

enum def FuelType {
    Gasoline;
    Diesel;
    Electric;
}

enum def Color {
    Red; Blue; Black; White; Silver;
}

action def DriveCycle {
    action start : StartEngine;
    action accel : Accelerate;
    action cruise : Cruise;
    action brake : Brake;

    first start then accel;
    first accel then cruise;
    first cruise then brake;
}

action def StartEngine {
}
action def Accelerate {
}
action def Cruise {
}
action def Brake {
}

state def VehicleStates {
    state off;
    state idle;
    state running;
    state moving;
    state stopped;

    transition first off then idle;
    transition first idle then running;
    transition first running then moving;
    transition first moving then stopped;
    transition first stopped then off;
}

requirement def MassRequirement {
    doc /* The vehicle mass shall not exceed 2000 kg. */
}

satisfy MassRequirement by Vehicle;

package VehicleDomain {
    part def SystemModel {
    }
}
`;
