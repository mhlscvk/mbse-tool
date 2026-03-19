package ViewsAndViewpoints {

  part def SafetyEngineer;

  concern def VehicleSafety {
    doc /* Vehicle must have necessary safety features. */
  }

  viewpoint def SafetyViewpoint {
    doc /* Safety engineering viewpoint. */
  }

  view def TreeView {
    doc /* Renders model elements as a tree diagram. */
  }

  view def PartsTreeView :> TreeView {
    doc /* A tree view filtered to show only parts. */
  }

  rendering def StandardRendering {
    doc /* Default rendering for diagram views. */
  }
}