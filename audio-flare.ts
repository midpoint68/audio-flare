/// <reference path="pocket/pocket.ts" />

var canvas: HTMLCanvasElement;
var ctx: CanvasRenderingContext2D;

window.addEventListener('load', load);
window.addEventListener('resize', () => {
    if (!canvas || !ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

async function load() {

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

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

    // Get a canvas defined with ID "oscilloscope"
    canvas = <HTMLCanvasElement>document.getElementById("canvas");
    if (!canvas) throw new Error("Canvas missing from document...");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) throw new Error("Could not create context...");
    ctx = canvasCtx;

    // Create particles
    interface SoundPoint {
        x: number
        y: number
        start_x: number
        start_y: number
        hue: number
        alpha: number
        size_mult: number
    }
    const pocket = new Pocket<SoundPoint>();
    const particles = new Array<Particle<SoundPoint>>();
    const num_particles = 500;

    for (let i = 0; i < num_particles; i++) {
        const sound_point: SoundPoint = {
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

    // Place 'speakers'
    const speakers = new Array<{ x: number, y: number, radius: number }>();
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

        // Render Points
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

}