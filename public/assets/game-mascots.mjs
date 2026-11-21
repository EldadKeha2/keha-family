export const FEZ_DINO = {id: 'fez-dino', name: 'דינוזאור עם תרבוש', nameEn: 'Dinosaur in a fez'};
export const FEZ_SNAKE = {id: 'fez-snake', name: 'נחש עם תרבוש', nameEn: 'Snake in a fez'};

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function fez(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.fillStyle = '#ac3735';
  ctx.beginPath();
  ctx.moveTo(-26, 2);
  ctx.lineTo(-19, -29);
  ctx.quadraticCurveTo(2, -34, 19, -28);
  ctx.lineTo(26, 2);
  ctx.quadraticCurveTo(0, 12, -26, 2);
  ctx.fill();
  ellipse(ctx, 0, -28, 19, 5, '#d96047');
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#312b2c';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1, -28);
  ctx.quadraticCurveTo(-37, -44, -33, -5);
  ctx.stroke();
  ellipse(ctx, -33, -1, 4, 8, '#312b2c');
  ctx.restore();
}

function eye(ctx, x, y) {
  ellipse(ctx, x, y, 11, 13, '#fff2c8');
  ellipse(ctx, x + 4, y + 1, 5.5, 8, '#263d39');
  ellipse(ctx, x + 5, y - 3, 2, 2, '#fffdf5');
}

function dino(ctx) {
  ctx.fillStyle = '#80955e';
  ctx.beginPath();
  ctx.moveTo(25, 122);
  ctx.bezierCurveTo(15, 93, 22, 55, 48, 47);
  ctx.bezierCurveTo(75, 38, 93, 49, 100, 68);
  ctx.bezierCurveTo(122, 62, 154, 63, 153, 85);
  ctx.quadraticCurveTo(155, 106, 127, 111);
  ctx.quadraticCurveTo(122, 132, 91, 133);
  ctx.lineTo(70, 131);
  ctx.quadraticCurveTo(53, 149, 23, 143);
  ctx.fill();
  ctx.fillStyle = '#b9c58f';
  ctx.beginPath();
  ctx.moveTo(71, 113);
  ctx.quadraticCurveTo(103, 127, 133, 105);
  ctx.quadraticCurveTo(122, 138, 83, 130);
  ctx.fill();
  ctx.strokeStyle = '#425e40';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(81, 102);
  ctx.quadraticCurveTo(113, 114, 145, 98);
  ctx.stroke();
  ctx.fillStyle = '#fff4d0';
  for (const x of [100, 118]) {
    ctx.beginPath();
    ctx.moveTo(x, 107);
    ctx.lineTo(x + 4, 116);
    ctx.lineTo(x + 9, 107);
    ctx.fill();
  }
  eye(ctx, 72, 74);
  ellipse(ctx, 137, 78, 4, 3, '#435d41');
  ellipse(ctx, 39, 108, 5, 4, '#9eaf75');
  ellipse(ctx, 49, 118, 3, 3, '#9eaf75');
  fez(ctx, 54, 50);
}

function snake(ctx) {
  // Side profile and forked tongue point along the snake's direction of travel.
  ctx.strokeStyle = '#ab4145';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(114, 108);
  ctx.quadraticCurveTo(135, 117, 145, 107);
  ctx.lineTo(153, 99);
  ctx.moveTo(145, 107);
  ctx.lineTo(154, 111);
  ctx.stroke();
  ctx.fillStyle = '#49906f';
  ctx.beginPath();
  ctx.moveTo(24, 99);
  ctx.bezierCurveTo(19, 63, 45, 45, 75, 50);
  ctx.bezierCurveTo(94, 52, 102, 66, 112, 73);
  ctx.bezierCurveTo(130, 79, 138, 89, 128, 105);
  ctx.bezierCurveTo(118, 122, 94, 126, 77, 133);
  ctx.bezierCurveTo(41, 151, 24, 130, 24, 99);
  ctx.fill();
  ctx.fillStyle = '#bdd192';
  ctx.beginPath();
  ctx.moveTo(55, 105);
  ctx.quadraticCurveTo(82, 123, 128, 103);
  ctx.quadraticCurveTo(119, 126, 74, 135);
  ctx.quadraticCurveTo(58, 133, 55, 105);
  ctx.fill();
  eye(ctx, 79, 79);
  ellipse(ctx, 119, 89, 3.5, 3, '#30594b');
  ellipse(ctx, 45, 94, 5, 4, '#79ae82');
  ellipse(ctx, 50, 104, 3, 3, '#79ae82');
  fez(ctx, 58, 54);
}

export function mascotPortrait(character, canvas) {
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (character.id === FEZ_DINO.id) dino(ctx);
  else snake(ctx);
  return canvas;
}
