export const activityImages = {
    run: {
        easy: "Run-Easy-2.png",
        long: "Run-Long-2.png",
        tempo: "Run-Tempo-2.png",
        intervals: "Run-SprintsHills-2.png",
        default: "Run-Default.png",
    },
    bike: {
        easy: "Bike-Easy.png",
        long: "Bike-Long.png",
        tempo: "Bike-Tempo.png",
        intervals: "Bike-SprintsHills.png",
        default: "Bike-Default.png",
    },
    swim: {
        easy: "Swim-Easy.png",
        long: "Swim-Long.png",
        tempo: "Swim-Tempo.png",
        intervals: "Swim-Sprints.png",
        default: "Swim-Default.png",
    },
    workout: {
        easy: "Workout-2.png",
        long: "Workout-2.png",
        tempo: "Workout-2.png",
        intervals: "Workout-2.png",
        default: "Workout-2.png",
    },
};

export const getDefaultImage = (type, intensity) => {
    const typeImages = activityImages[type];

    if (!typeImages) return "Run-Default.png";

    return typeImages[intensity] || typeImages.default;
};