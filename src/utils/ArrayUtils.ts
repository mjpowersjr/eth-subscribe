export type ArrayComparisonResult<T> = {
    common: T[];
    added: T[];
    removed: T[];
};

export class ArrayUtils {
    /**
    * Compares two arrays and returns the common, added, and removed elements.
    * 
    * @param oldArray - The initial array.
    * @param newArray - The array to compare against.
    * @returns An object containing the common, added, and removed elements.
    */
    static compare<T>(oldArray: Array<T> | Set<T>, newArray: Array<T> | Set<T>): ArrayComparisonResult<T> {
        const oldSet = new Set(oldArray);
        const newSet = new Set(newArray);

        const common: T[] = [];
        const added: T[] = [];
        const removed: T[] = [];

        // Find common and added elements
        for (const item of newSet) {
            if (oldSet.has(item)) {
                common.push(item);
            } else {
                added.push(item);
            }
        }

        // Find removed elements
        for (const item of oldSet) {
            if (!newSet.has(item)) {
                removed.push(item);
            }
        }

        return { common, added, removed };
    }
}
