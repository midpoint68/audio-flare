"use strict";
/*!
 * Copyright (c) Trevor Richard
 */
class Particle {
    constructor({ x, y, z = 0, radius = 0, data }) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.radius = this.setRadius(radius);
        this.data = data;
    }
    moveTo(position) {
        if (!position.z)
            position.z = 0;
        if (this.pocket && this.subPocket) {
            this.subPocket.retrieve(this);
            this.x = position.x;
            this.y = position.y;
            this.z = position.z;
            this.pocket.put(this);
        }
    }
    setRadius(radius) {
        if (radius <= 0)
            throw new Error("Particle radius must be greater than zero.");
        this.radius = radius;
        return radius;
    }
    retrieve() {
        if (!this.subPocket)
            return undefined;
        return this.subPocket.retrieve(this);
    }
}
class SubPocket {
    constructor({ parent, radius, position }) {
        this.parent = parent;
        this.radius = radius;
        this.pockets = new Array();
        this.particles = new Array();
        this.position = position;
    }
    put(p) {
        const diff = Pocket.Tools.sub(this.position, p);
        const dist = Pocket.Tools.mag(diff);
        if (dist + p.radius < this.radius) {
            if (p.radius >= this.radius / Pocket.Tools.MAGIC_RATIO) {
                this.particles.push(p);
                p.subPocket = this;
                return p;
            }
            else {
                for (let i = 0; i < this.pockets.length; i++) {
                    const result = this.pockets[i].put(p);
                    if (result)
                        return result;
                }
                const sp = new SubPocket({
                    parent: this,
                    radius: this.radius / Pocket.Tools.MAGIC_RATIO,
                    position: {
                        x: p.x,
                        y: p.y,
                        z: p.z
                    }
                });
                this.pockets.push(sp);
                return sp.put(p);
            }
        }
        else {
            return undefined;
        }
    }
    retrieve(p) {
        this.particles = this.particles.filter(p => p != p);
        if (this.pockets.length == 0 && this.particles.length == 0) {
            this.parent.remove(this);
        }
        return p;
    }
    remove(sp) {
        this.pockets = this.pockets.filter(p => p != sp);
        if (this.pockets.length == 0 && this.particles.length == 0) {
            this.parent.remove(this);
        }
    }
    search(radius, center) {
        var found = new Array();
        const diff = Pocket.Tools.sub(this.position, center);
        const dist = Pocket.Tools.mag(diff);
        if (dist - radius < this.radius) {
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                const p_diff = Pocket.Tools.sub(p, center);
                const p_dist = Pocket.Tools.mag(p_diff);
                if (p_dist - radius < p.radius) {
                    found.push(p);
                }
            }
            for (let i = 0; i < this.pockets.length; i++) {
                found = found.concat(this.pockets[i].search(radius, center));
            }
        }
        return found;
    }
}
class Pocket {
    constructor() {
        this.root = undefined;
    }
    put(particle) {
        particle.pocket = this;
        if (this.root) {
            const result = this.root.put(particle);
            if (result)
                return result;
        }
        const sp_radius = Pocket.Tools.MAGIC_RATIO * particle.radius;
        const sp = new SubPocket({
            parent: this,
            radius: this.root ? Math.max(this.root.radius, sp_radius) : sp_radius,
            position: {
                x: particle.x,
                y: particle.y,
                z: particle.z
            }
        });
        if (!this.root) {
            this.root = sp;
        }
        else {
            const max_dist = Pocket.Tools.mag(Pocket.Tools.sub(this.root.position, sp.position)) + sp.radius;
            const new_root = new SubPocket({
                parent: this,
                radius: Pocket.Tools.MAGIC_RATIO * max_dist,
                position: this.root.position
            });
            this.root.parent = new_root;
            sp.parent = new_root;
            new_root.pockets.push(this.root);
            new_root.pockets.push(sp);
            this.root = new_root;
        }
        const result = sp.put(particle);
        if (!result) {
            throw new Error("Result expected for put call...");
        }
        return result;
    }
    remove(sp) {
        if (sp == this.root) {
            this.root = undefined;
        }
    }
    search(radius, center) {
        if (!center.z)
            center.z = 0;
        if (this.root) {
            return this.root.search(radius, center);
        }
        else {
            return new Array();
        }
    }
    closest(position, startRadius) {
        if (!position.z)
            position.z = 0;
        if (this.root) {
            if (!startRadius)
                startRadius = this.root.radius / 100;
            for (let r = startRadius; r < this.root.radius * 2; r *= 2) {
                const pool = this.root.search(r, position);
                if (pool.length > 0) {
                    let closest = pool[0];
                    let dist = Pocket.Tools.mag(Pocket.Tools.sub(closest, position));
                    for (let i = 1; i < pool.length; i++) {
                        const p = pool[i];
                        const p_dist = Pocket.Tools.mag(Pocket.Tools.sub(p, position));
                        if (p_dist < dist) {
                            closest = p;
                            dist = p_dist;
                        }
                    }
                    return closest;
                }
            }
        }
        return undefined;
    }
    all() {
        if (!this.root)
            return new Array();
        return this.search(this.root.radius, this.root.position);
    }
}
Pocket.Tools = {
    MAGIC_RATIO: 1.9,
    sub: (v0, v1) => {
        return {
            x: v0.x - v1.x,
            y: v0.y - v1.y,
            z: (v0.z || 0) - (v1.z || 0)
        };
    },
    mag: (v) => {
        return Math.sqrt(Math.pow(Math.sqrt(v.x * v.x + v.y * v.y), 2) + (v.z || 0) * (v.z || 0));
    }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var canvas;
var ctx;
window.addEventListener('load', load);
window.addEventListener('resize', () => {
    if (!canvas || !ctx)
        return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
function load() {
    return __awaiter(this, void 0, void 0, function* () {
        const stream = yield navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const audio_ctx = new window.AudioContext();
        const source = audio_ctx.createMediaStreamSource(stream);
        const analyser = audio_ctx.createAnalyser();
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        const avg_analyser = audio_ctx.createAnalyser();
        avg_analyser.smoothingTimeConstant = 0.97;
        source.connect(avg_analyser);
        const size = 2048;
        const ref_size = 64;
        analyser.fftSize = size;
        avg_analyser.fftSize = size;
        var buffer_length = Math.floor(0.6 * analyser.frequencyBinCount);
        var buffer_start = 0;
        const fft_skip = Math.floor((buffer_length - buffer_start) / ref_size);
        var data_array = new Uint8Array(buffer_length);
        var avg_data_array = new Uint8Array(buffer_length);
        var time_array = new Float32Array(buffer_length);
        analyser.getByteFrequencyData(data_array);
        avg_analyser.getByteFrequencyData(avg_data_array);
        analyser.getFloatTimeDomainData(time_array);
        canvas = document.getElementById("canvas");
        if (!canvas)
            throw new Error("Canvas missing from document...");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        var canvasCtx = canvas.getContext("2d");
        if (!canvasCtx)
            throw new Error("Could not create context...");
        ctx = canvasCtx;
        const pocket = new Pocket();
        const particles = new Array();
        const num_particles = 500;
        for (let i = 0; i < num_particles; i++) {
            const sound_point = {
                x: 0,
                y: 0,
                start_x: Math.random(),
                start_y: Math.random(),
                hue: Math.floor(Math.random() * 360),
                alpha: 0.2,
                size_mult: 1
            };
            const particle = new Particle({
                x: sound_point.start_x,
                y: sound_point.start_y,
                z: 0,
                radius: 0.0015 + Math.random() * 0.01,
                data: sound_point
            });
            pocket.put(particle);
            particles.push(particle);
        }
        const speakers = new Array();
        for (let i = buffer_start; i < buffer_length; i += fft_skip) {
            speakers[i] = {
                x: 1.0 * i / buffer_length + (0.1 * Math.random() - 0.05),
                y: Math.random(),
                radius: 0.1
            };
        }
        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(data_array);
            avg_analyser.getByteFrequencyData(avg_data_array);
            analyser.getFloatTimeDomainData(time_array);
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (var i = buffer_start; i < buffer_length; i += fft_skip) {
                const amp = data_array[i];
                const avg_amp = avg_data_array[i];
                const amp_dec = amp / 255.0;
                const avg_amp_dec = avg_amp / 255.0;
                const amp_diff = (amp_dec - avg_amp_dec);
                const speaker = speakers[i];
                const affected_points = pocket.search(speaker.radius, { x: speaker.x, y: speaker.y });
                affected_points.forEach(particle => {
                    const diff = {
                        x: particle.x - speaker.x,
                        y: particle.y - speaker.y
                    };
                    const dist = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
                    const effect = (speaker.radius - Math.min(dist, speaker.radius)) / speaker.radius;
                    const amp_effect = Math.sqrt(effect);
                    if (amp_diff > 0) {
                        const move = {
                            x: 1.0 / 18 * Math.sign(diff.x) * amp_effect * amp_diff,
                            y: 1.0 / 18 * Math.sign(diff.y) * amp_effect * amp_diff
                        };
                        particle.data.x += move.x;
                        particle.data.y += move.y;
                        particle.data.hue = particle.data.hue * (1 - effect) + (i * effect * 320.0 / buffer_length);
                    }
                    particle.data.size_mult += Math.sqrt(effect * amp_dec);
                });
            }
            particles.forEach(particle => {
                const avg_dim = canvas.width + canvas.height;
                const radius = particle.radius * particle.data.size_mult * avg_dim;
                const radius_y_mod = radius * time_array[Math.min(Math.abs(Math.floor(buffer_length * particle.data.x / canvas.width)), buffer_length - 1)] / 4;
                const radius_x_mod = -radius_y_mod;
                ctx.fillStyle = `hsla(${Math.floor(particle.data.hue)}, 100%, ${Math.min(50 * (particle.data.size_mult - 1), 50)}%, ${particle.data.alpha})`;
                ctx.beginPath();
                ctx.ellipse(particle.data.x * canvas.width, particle.data.y * canvas.height, radius + radius_x_mod, radius + radius_y_mod, 0, 0, Math.PI * 2);
                ctx.fill();
                const ratio = 0.1;
                particle.data.x = ratio * particle.data.start_x + (1 - ratio) * particle.data.x;
                particle.data.y = ratio * particle.data.start_y + (1 - ratio) * particle.data.y;
                particle.moveTo({ x: particle.data.x, y: particle.data.y });
                particle.data.size_mult = 1;
            });
        }
        draw();
    });
}
