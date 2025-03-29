import Phaser from "phaser";

// define a class for cheese
// including the position and the type of cheese
// cheese can be either a wolf or a sheep

class Cheese {
  constructor(x, y, type, size) {
    this.x = x;
    this.y = y;
    this.type = type; // 'wolf' or 'sheep'
    this.alive = true; // whether the cheese is alive or not
    this.graphics = null; // reference to the graphics object for drawing
    this.size = size || 10; // default size of the cheese
  }
}
class WolfSheep {
  constructor() {
    this.wolf_number = 3;
    this.sheep_number = 15;

    this.wolf = [];
    this.sheep = [];

    this.wolf.push(new Cheese(0, 0, "wolf", 30));
    this.wolf.push(new Cheese(2, 0, "wolf", 30));
    this.wolf.push(new Cheese(4, 0, "wolf", 30));

    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 3; y++) {
        this.sheep.push(new Cheese(x, y + 2, "sheep", 20));
      }
    }
  }
}
class Example extends Phaser.Scene {
  graphics;
  path;
  follower;
  cheeseboardGraphics;
  wolfsheep;
  positions; // 存储所有位置的数组

  create() {
    this.wolfsheep = new WolfSheep();
    this.positions = [];
    // Draw the cheeseboard
    this.graphics = this.add.graphics();
    this.cheeseboardGraphics = this.add.graphics(); // Separate graphics for the cheeseboard

    // Draw the cheeseboard once with an offset
    const gridSize = 150;
    const offsetX = 100; // Horizontal offset
    const offsetY = 100; // Vertical offset

    this.cheeseboardGraphics.lineStyle(2, 0xffff00, 1);
    this.cheese_lines = [];
    for (let i = 0; i < 5; i++) {
      this.cheese_lines.push({
        x1: offsetX,
        y1: offsetY + i * gridSize,
        x2: offsetX + gridSize * 4,
        y2: offsetY + i * gridSize,
      });
      this.cheese_lines.push({
        x1: offsetX + i * gridSize,
        y1: offsetY,
        x2: offsetX + i * gridSize,
        y2: offsetY + gridSize * 4,
      });
      for (let j = 0; j < 5; j++) {
        if (!this.positions[i]) {
          this.positions[i] = [];
        }
        this.positions[i][j] = {
          x: offsetX + i * gridSize,
          y: offsetY + j * gridSize,
        };
      }
    }
    // Draw the cheeseboard lines
    this.cheese_lines.forEach((pos) => {
      this.cheeseboardGraphics.lineBetween(pos.x1, pos.y1, pos.x2, pos.y2);
    });
  }

  update() {
    // Draw the wolf and sheep
    this.wolfsheep.wolf.forEach((cheese) => {
      cheese.graphics = this.add.graphics();
      cheese.graphics.fillStyle(0xff0000, 1); // Red for wolf
      cheese.graphics.fillCircle(
        this.positions[cheese.x][cheese.y].x,
        this.positions[cheese.x][cheese.y].y,
        cheese.size
      );
    });

    this.wolfsheep.sheep.forEach((cheese) => {
      cheese.graphics = this.add.graphics();
      cheese.graphics.fillStyle(0x00ff00, 1); // Green for sheep
      cheese.graphics.fillCircle(
        this.positions[cheese.x][cheese.y].x,
        this.positions[cheese.x][cheese.y].y,
        cheese.size
      );
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 800,
  // 将背景色设置为透明
  backgroundColor: 0x2d2d2d00,
  // 指定游戏要挂载的容器
  parent: "game-container",
  scene: Example,
};

const game = new Phaser.Game(config);
