// Pile de taille fixe
// Si on atteint la taille maximale, le prochain push supprime l'élément le plus ancien
class CircularFixedStack {
    constructor(maxSize) {
        this.stack = [];
        this.maxSize = maxSize;
    }

    push(item) {
        if (this.stack.length >= this.maxSize) {
            // Supprimer le plus ancien élément (index 0)
            this.stack.shift();
        }
        this.stack.push(item);
    }

    pop() {
        return this.stack.pop();
    }

    peek() {
        return this.stack[this.stack.length - 1];
    }

    isEmpty() {
        return this.stack.length === 0;
    }

    isFull() {
        return this.stack.length === this.maxSize;
    }

    size() {
        return this.stack.length;
    }
}