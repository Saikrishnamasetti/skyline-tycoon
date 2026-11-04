import type { GroupId } from '@shared';

/**
 * Simplified national flags for the country bands on city tiles. Flags are
 * drawn from basic shapes at whatever size the tile needs.
 */
export function drawFlag(
  ctx: CanvasRenderingContext2D,
  group: GroupId,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const bandsH = (colors: string[]) =>
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y + (h / colors.length) * i, w, h / colors.length + 1);
    });
  const bandsV = (colors: string[]) =>
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + (w / colors.length) * i, y, w / colors.length + 1, h);
    });

  switch (group) {
    case 'egypt':
      bandsH(['#ce1126', '#ffffff', '#000000']);
      ctx.fillStyle = '#c09300';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'brazil':
      ctx.fillStyle = '#009c3b';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#ffdf00';
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h * 0.1);
      ctx.lineTo(x + w * 0.92, y + h / 2);
      ctx.lineTo(x + w / 2, y + h * 0.9);
      ctx.lineTo(x + w * 0.08, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#002776';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'turkey': {
      ctx.fillStyle = '#e30a17';
      ctx.fillRect(x, y, w, h);
      const cx = x + w * 0.38;
      const cy = y + h / 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, h * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e30a17';
      ctx.beginPath();
      ctx.arc(cx + h * 0.08, cy, h * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      star(ctx, x + w * 0.62, cy, h * 0.12);
      break;
    }
    case 'spain':
      ctx.fillStyle = '#aa151b';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#f1bf00';
      ctx.fillRect(x, y + h * 0.25, w, h * 0.5);
      break;
    case 'italy':
      bandsV(['#009246', '#ffffff', '#ce2b37']);
      break;
    case 'germany':
      bandsH(['#000000', '#dd0000', '#ffce00']);
      break;
    case 'britain': {
      ctx.fillStyle = '#012169';
      ctx.fillRect(x, y, w, h);
      const diag = (color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
      };
      diag('#ffffff', h * 0.2);
      diag('#c8102e', h * 0.07);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + w / 2 - h * 0.17, y, h * 0.34, h);
      ctx.fillRect(x, y + h / 2 - h * 0.17, w, h * 0.34);
      ctx.fillStyle = '#c8102e';
      ctx.fillRect(x + w / 2 - h * 0.1, y, h * 0.2, h);
      ctx.fillRect(x, y + h / 2 - h * 0.1, w, h * 0.2);
      break;
    }
    case 'japan':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#bc002d';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
