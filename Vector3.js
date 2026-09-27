export default class Vector3 {
    
    static fromCoords = (x0, y0, z0, x1, y1, z1) => new Vector3(x1-x0, y1-y0, z1-z0)

    static fromPitchYaw = (pitch, yaw) => {
        const f = Math.cos(-yaw * 0.017453292 - Math.PI)
        const f1 = Math.sin(-yaw * 0.017453292 - Math.PI)
        const f2 = -Math.cos(-pitch * 0.017453292)
        const f3 = Math.sin(-pitch * 0.017453292)
        return new Vector3(f1*f2, f3, f*f2).normalize()
    }

    constructor(x, y, z) {
        this.x = x ?? 0
        this.y = y ?? 0
        this.z = z ?? 0
    }

    getComponents() {
        return [this.x, this.y, this.z]
    }

    subtract(vector3) {
        return new Vector3(
            this.x - vector3.x,
            this.y - vector3.y,
            this.z - vector3.z
        )
    }

    add(vector3) {
        if (vector3 instanceof Vector3) {
            this.x += vector3.x
            this.y += vector3.y
            this.z += vector3.z
            return this
        }
        this.x += vector3[0]
        this.y += vector3[1]
        this.z += vector3[2]
        return this
    }

    dotProduct(vector3) {
        let [x1, y1, z1] = this.getComponents()
        let [x2, y2, z2] = vector3.getComponents()
        return (x1*x2) + (y1*y2) + (z1*z2)
    }

    crossProduct(vector3) {
        let [x1, y1, z1] = this.getComponents()
        let [x2, y2, z2] = vector3.getComponents()
        return new Vector3(
            (y1*z2) - (z1*y2),
            -((x1*z1) - (z1*x2)),
            (x1*y2) - (y1*x2)
        )
    }

    getLength() {
        return Math.sqrt(this.x**2 + this.y**2 + this.z**2)
    }

    getAngleRad(vector3) {
        return Math.acos(this.dotProduct(vector3) / (this.getLength() * vector3.getLength()))
    }

    getAngleDeg(vector3) {
        return 180/Math.PI * this.getAngleRad(vector3)
    }

    getPlaneEquation(point1, point2, point3) {
        let [p1x, p1y, p1z] = point1
        let [p2x, p2y, p2z] = point2
        let [p3x, p3y, p3z] = point3
        let d1 = new Vector3(p2x - p1x, p2y - p1y, p2z - p1z)
        let d2 = new Vector3(p3x - p1x, p3y - p1y, p3z - p1z)
        let normal = d1.crossProduct(d2)
        return [
            ...normal.getComponents(),
            -(new Vector3(...point1).dotProduct(normal))
        ]
    }

    normalize() {
        const len = this.getLength()
        if (len === 0) return this
        this.x = this.x / len
        this.y = this.y / len
        this.z = this.z / len
        return this
    }

    getYaw() {
        // Cloning to avoid modifying the current vector during normalization
        const v = this.copy().normalize()
        return 180/Math.PI * -Math.atan2(v.x, v.z)
    }

    getPitch() {
        const v = this.copy().normalize()
        return 180/Math.PI * (-Math.asin(v.y))
    }
    
    toString() {
        return `Vector3(x=${this.x},y=${this.y},z=${this.z})`
    }

    rotate(degrees, reverse=false) {
        if (reverse) degrees = (360 - degrees)%360
        switch (degrees) {
            case 90:
                ;[this.x, this.z] = [this.z, -this.x]
                break
            case 180:
                ;[this.x, this.z] = [-this.x, -this.z]
                break
            case 270:
                ;[this.x, this.z] = [-this.z, this.x]
                break
        }
        return this
    }
    multiply(factor) {
        this.x *= factor
        this.y *= factor
        this.z *= factor
        return this
    }

    getX() { return this.x }
    getY() { return this.y }
    getZ() { return this.z }

    copy() {
        return new Vector3(this.x, this.y, this.z)
    }
}