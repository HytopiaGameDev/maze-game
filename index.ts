/**
 * HYTOPIA SDK Boilerplate
 *
 * This is a simple boilerplate to get started on your project.
 * It implements the bare minimum to be able to run and connect
 * to your game server and run around as the basic player entity.
 *
 * From here you can begin to implement your own game logic
 * or do whatever you want!
 *
 * You can find documentation here: https://github.com/hytopiagg/sdk/blob/main/docs/server.md
 *
 * For more in-depth examples, check out the examples folder in the SDK, or you
 * can find it directly on GitHub: https://github.com/hytopiagg/sdk/tree/main/examples/payload-game
 *
 * You can officially report bugs or request features here: https://github.com/hytopiagg/sdk/issues
 *
 * To get help, have found a bug, or want to chat with
 * other HYTOPIA devs, join our Discord server:
 * https://discord.gg/DXCXJbHSJX
 *
 * Official SDK Github repo: https://github.com/hytopiagg/sdk
 * Official SDK NPM Package: https://www.npmjs.com/package/hytopia
 */

import { PlayerCameraMode, PlayerEntity, startServer } from "hytopia";

import worldMap from "./assets/map.json" with { type: "json" };
import { BlockTypeOptions } from "hytopia";

/**
 * startServer is always the entry point for our game.
 * It accepts a single function where we should do any
 * setup necessary for our game. The init function is
 * passed a World instance which is the default
 * world created by the game server on startup.
 *
 * Documentation: https://github.com/hytopiagg/sdk/blob/main/docs/server.startserver.md
 */

const BLOCK_TYPE_FLOOR = 1;
const BLOCK_TYPE_START = 2;
const BLOCK_TYPE_GOAL = 3;
const BLOCK_TYPE_WALL = 4;
const BLOCK_TYPE_VISITED = 5;

enum CellType {
	Solid = 0,
	Empty,
}

const enum Direction {
	Up,
	Down,
	Left,
	Right,
}

type Vector2 = { x: number; z: number };

function offset(pos: Vector2, dir: Direction, scale: number): Vector2 {
	switch (dir) {
		case Direction.Up:
			return { x: pos.x, z: pos.z - scale };
		case Direction.Down:
			return { x: pos.x, z: pos.z + scale };
		case Direction.Left:
			return { x: pos.x - scale, z: pos.z };
		case Direction.Right:
			return { x: pos.x + scale, z: pos.z };
	}
}

function keyOf(vec: Vector2): string {
	return `${vec.x},${vec.z}`;
}

class Maze {
	readonly width: number;
	readonly height: number;

	cells: Array<CellType>;
	startIndex: number;
	goalIndex: number;

	constructor(width: number, height: number) {
		this.width = width + (width % 2 == 0 ? 1 : 0);
		this.height = height + (height % 2 == 0 ? 1 : 0);

		this.startIndex = this.linearize(1, 1);
		this.goalIndex = this.linearize(this.width - 2, this.height - 2);

		this.cells = new Array(this.width * this.height);
		for (let z = 0; z < this.height; z++) {
			for (let x = 0; x < this.width; x++) {
				this.cells[z * this.width + x] = CellType.Solid;
			}
		}

		this.cells[this.startIndex] = CellType.Empty;

		console.log("start generate maze");
		this.generateMaze();
		console.log("done generating maze");
	}

	linearize(x: number, z: number): number {
		return z * this.width + x;
	}

	delinearize(index: number): Vector2 {
		return { x: index % this.width, z: Math.floor(index / this.width) };
	}

	setCellType(x: number, z: number, cellType: CellType) {
		this.cells[this.linearize(x, z)] = cellType;
	}

	getCellType(x: number, z: number): CellType {
		return this.cells[this.linearize(x, z)];
	}

	generateMaze() {
		let unvisitedIntersections =
			Math.floor(this.width / 2) * Math.floor(this.height / 2) - 1;

		while (unvisitedIntersections > 0) {
			const start = this.randomOddCell();
			const path = this.randomWalk(start);

			let curr = start;
			while (this.getCellType(curr.x, curr.z) == CellType.Solid) {
				console.log(curr);
				this.setCellType(curr.x, curr.z, CellType.Empty);
				const dir = path.get(keyOf(curr))!;
				const between = offset(curr, dir, 1);
				this.setCellType(between.x, between.z, CellType.Empty);
				curr = offset(curr, dir, 2);
				unvisitedIntersections--;
				console.log(unvisitedIntersections);
			}
		}
	}

	randomWalk(
		start: Vector2,
	): Map<string, Direction> {
		const path = new Map();
		let curr = start;

		while (this.getCellType(curr.x, curr.z) == CellType.Solid) {
			const dir = this.randomDir();
			const nextPos = offset(curr, dir, 2);

			if (
				nextPos.x < 0 || nextPos.z < 0 || nextPos.x > this.width - 1 ||
				nextPos.z > this.height - 1
			) {
				continue;
			}

			if (this.getCellType(nextPos.x, nextPos.z) == CellType.Solid) {
				path.set(keyOf(curr), dir);
				curr = nextPos;
			} else {
				path.set(keyOf(curr), dir);
				break;
			}
		}

		return path;
	}

	randomOddCell(): Vector2 {
		while (true) {
			const x = Math.floor(Math.random() * this.width);
			const z = Math.floor(Math.random() * this.height);

			if (x % 2 == 1 && z % 2 == 1) {
				return { x: x, z: z };
			}
		}
	}

	randomDir(): Direction {
		const index = Math.floor(Math.random() * 4);

		switch (index) {
			case 0:
				return Direction.Up;
			case 1:
				return Direction.Down;
			case 2:
				return Direction.Left;
			case 3:
				return Direction.Right;
			default:
				throw new Error();
		}
	}
}

class MazeWorld {
	maze: Maze;
	blockTypes: BlockTypeOptions[];
	blocks: {
		[coordinate: string]: number;
	};

	constructor(maze: Maze) {
		this.maze = maze;
		this.blocks = {};
		this.blockTypes = [
			{
				id: BLOCK_TYPE_FLOOR,
				name: "bricks",
				textureUri: "textures/bricks.png",
			},
			{
				id: BLOCK_TYPE_START,
				name: "start",
				textureUri: "textures/red.png",
			},
			{
				id: BLOCK_TYPE_GOAL,
				name: "goal",
				textureUri: "textures/green.png",
			},
			{
				id: BLOCK_TYPE_WALL,
				name: "leaves",
				textureUri: "textures/leaves.png",
			},
			{
				id: BLOCK_TYPE_VISITED,
				name: "visited",
				textureUri: "textures/blue.png",
			},
		];

		this.generateBlocks();
	}

	generateBlocks() {
		this.maze.cells.forEach((cell, index) => {
			const pos = this.maze.delinearize(index);
			if (cell === CellType.Solid) {
				this.addBlock(pos.x, 1, pos.z, 4);
				this.addBlock(pos.x, 2, pos.z, 4);
			}

			let id = 1;
			if (index == this.maze.startIndex) {
				id = 2;
			} else if (index == this.maze.goalIndex) {
				id = 3;
			}
			this.addBlock(pos.x, 0, pos.z, id);
		});
	}

	addBlock(x: number, y: number, z: number, id: number) {
		this.blocks[`${x},${y},${z}`] = id;
	}
}

startServer((world) => {
	/**
	 * Enable debug rendering of the physics simulation.
	 * This will overlay lines in-game representing colliders,
	 * rigid bodies, and raycasts. This is useful for debugging
	 * physics-related issues in a development environment.
	 * For larger worlds, enabling this can cause performance
	 * issues, which will be noticed as dropped frame rates
	 * and higher RTT times.
	 */
	// world.simulation.enableDebugRendering(true);

	/**
	 * Load our map.
	 * You can build your own map using https://build.hytopia.com
	 * After building, hit export and drop the .json file in
	 * the assets folder as map.json.
	 */

	const mazeWorld = new MazeWorld(new Maze(31, 31));
	world.loadMap(mazeWorld);

	/**
	 * Handle player joining the game. The onPlayerJoin
	 * function is called when a new player connects to
	 * the game. From here, we create a basic player
	 * entity instance which automatically handles mapping
	 * their inputs to control their in-game entity and
	 * internally uses our default character controller.
	 */
	world.onPlayerJoin = (player) => {
		const playerEntity = new PlayerEntity({
			player,
			name: "Player",
			modelUri: "models/player.gltf",
			modelLoopedAnimations: ["idle"],
			modelScale: 0.7,
		});

		// hardcoded starting point...
		playerEntity.spawn(world, { x: 1.5, y: 3, z: 1.5 });
		playerEntity.player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
		playerEntity.player.camera.setOffset({ x: 0, y: 0.7, z: 0 });
		playerEntity.player.camera.setModelHiddenNodes(["head", "neck"]);

		// Send a nice welcome message that only the player who joined will see ;)
		world.chatManager.sendPlayerMessage(
			player,
			"Welcome to the game!",
			"00FF00",
		);
		world.chatManager.sendPlayerMessage(player, "Use WASD to move around.");
		world.chatManager.sendPlayerMessage(player, "Press space to jump.");
		world.chatManager.sendPlayerMessage(player, "Hold shift to sprint.");
		world.chatManager.sendPlayerMessage(
			player,
			"Press \\ to enter or exit debug view.",
		);
	};

	/**
	 * Handle player leaving the game. The onPlayerLeave
	 * function is called when a player leaves the game.
	 * Because HYTOPIA is not opinionated on join and
	 * leave game logic, we are responsible for cleaning
	 * up the player and any entities associated with them
	 * after they leave. We can easily do this by
	 * getting all the known PlayerEntity instances for
	 * the player who left by using our world's EntityManager
	 * instance.
	 */
	world.onPlayerLeave = (player) => {
		world.entityManager.getAllPlayerEntities(player).forEach((entity) =>
			entity.despawn()
		);
	};

	world.chatManager.registerCommand("/regenerate", (player, args) => {
		const width = Number.parseInt(args[0]);
		const height = Number.parseInt(args[1]);
		world.chatManager.sendPlayerMessage(
			player,
			`generating a ${width} by ${height} maze.`,
		);

		world.chunkLattice.getAllChunks().forEach((chunk) => chunk.despawn());
		world.loadMap(new MazeWorld(new Maze(width, height)));
	});
});
