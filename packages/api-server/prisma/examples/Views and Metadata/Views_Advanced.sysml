package ViewsAdvanced {
    part def Vehicle;
    part def Engine;

    part vehicle : Vehicle {
        part engine : Engine;
    }

    /* Viewpoint definition */
    viewpoint def SafetyViewpoint {
        doc /* Focus on safety-related elements and their relationships. */

        stakeholder safetyEngineer;
    }

    viewpoint def StructureViewpoint {
        doc /* Show system decomposition and part hierarchy. */
    }

    /* Rendering definition */
    rendering def TreeRendering;
    rendering def TableRendering;

    /* View definitions with expose and render */
    view def PartsTreeView {
        expose ViewsAdvanced::*;

        render asTree : TreeRendering;
    }

    view def SafetyView {
        expose ViewsAdvanced::Vehicle;
        expose ViewsAdvanced::Engine;

        render asTable : TableRendering;
    }

    /* View usages */
    view partsTree : PartsTreeView;

    /* Viewpoint usage */
    viewpoint safetyVP : SafetyViewpoint;

    /* Rendering usage */
    rendering treeRender : TreeRendering;

    /* Concern usage */
    concern def ReliabilityConcern {
        doc /* Ensure system components meet reliability targets. */
    }

    concern reliabilityCheck : ReliabilityConcern;

    /* Metadata usage */
    metadata def Approval {
        attribute approved : Boolean;
        attribute approver : String;
    }

    metadata approvalStatus : Approval;
}
