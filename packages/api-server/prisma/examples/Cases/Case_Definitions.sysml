package CaseDefinitions {
    part def Vehicle;
    part def Driver;
    part def Passenger;
    part def Environment;

    requirement def SafetyRequirement {
        doc /* The system shall operate safely under all conditions. */
    }

    /* Base case definition */
    case def SystemTestCase {
        subject systemUnderTest : Vehicle;
        objective testObjective : SafetyRequirement;
    }

    /* Use case with actors */
    use case def TransportPassenger {
        subject vehicle : Vehicle;
        actor driver : Driver;
        actor passenger : Passenger;

        include use case boardVehicle;
        include use case driveToDestination;
        include use case exitVehicle;

        action boardVehicle;
        action driveToDestination;
        action exitVehicle;

        first start then boardVehicle;
        first boardVehicle then driveToDestination;
        first driveToDestination then exitVehicle;
        first exitVehicle then done;
    }

    /* Case usage */
    case safetyTest : SystemTestCase;

    use case transportTrip : TransportPassenger {
        subject vehicle : Vehicle;
        actor driver : Driver;
    }
}
