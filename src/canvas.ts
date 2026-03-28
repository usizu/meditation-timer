interface Star {
	x: number;
	y: number;
	z: number /* depth 0–1: controls size and brightness */;
	twinkleSpeed: number;
	twinkleOffset: number;
}

interface Nebula {
	x: number;
	y: number;
	radius: number;
	hue: number;
	alpha: number;
}

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let stars: Star[] = [];
let nebulae: Nebula[] = [];
let rafId = 0;
let w = 0;
let h = 0;

const STAR_COUNT = 300;
const NEBULA_COUNT = 4;

function resize(): void {
	w = window.innerWidth;
	h = window.innerHeight;
	canvas.width = w * devicePixelRatio;
	canvas.height = h * devicePixelRatio;
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function createStar(): Star {
	return {
		x: Math.random() * w,
		y: Math.random() * h,
		z: Math.random(),
		twinkleSpeed: 0.5 + Math.random() * 2,
		twinkleOffset: Math.random() * Math.PI * 2,
	};
}

function createNebula(): Nebula {
	return {
		x: Math.random() * w,
		y: Math.random() * h,
		radius: 100 + Math.random() * 200,
		hue: Math.random() > 0.5 ? 280 : 160 /* lavender or mint */,
		alpha: 0.02 + Math.random() * 0.03,
	};
}

function initObjects(): void {
	stars = Array.from({ length: STAR_COUNT }, createStar);
	nebulae = Array.from({ length: NEBULA_COUNT }, createNebula);
}

function draw(time: number): void {
	ctx.clearRect(0, 0, w, h);

	/* nebulae */
	for (const n of nebulae) {
		const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
		grad.addColorStop(0, `hsla(${n.hue}, 80%, 50%, ${n.alpha})`);
		grad.addColorStop(1, "transparent");
		ctx.fillStyle = grad;
		ctx.fillRect(n.x - n.radius, n.y - n.radius, n.radius * 2, n.radius * 2);
	}

	/* stars */
	const t = time / 1000;
	for (const s of stars) {
		const twinkle =
			0.4 + 0.6 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset) ** 2;
		const size = 0.5 + s.z * 1.5;
		const brightness = Math.floor(180 + s.z * 75);

		ctx.beginPath();
		ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness + 40}, ${twinkle})`;
		ctx.fill();
	}

	rafId = requestAnimationFrame(draw);
}

export function initStarfield(el: HTMLCanvasElement): void {
	canvas = el;
	const c = canvas.getContext("2d");
	if (!c) return;
	ctx = c;

	resize();
	initObjects();

	window.addEventListener("resize", () => {
		resize();
		initObjects();
	});

	rafId = requestAnimationFrame(draw);
}

export function destroyStarfield(): void {
	cancelAnimationFrame(rafId);
}
