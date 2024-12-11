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

import {
	ColliderShape,
	PlayerCameraMode,
	PlayerEntity,
	startServer,
	Vector3,
} from "hytopia";
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

/**
 * The position you get when stepping in a given direction for a given amount of tiles.
 *
 * @param pos the position to step from
 * @param dir the direction to step in
 * @param scale the number of tiles to step
 */
function stepIn(pos: Vector2, dir: Direction, scale: number): Vector2 {
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

/**
 * Returns a hash value for any Vector2 that is perfect for coordinates in [0, 2^16)
 *
 * @param vec the vector to generate a hash value for
 */
function hash(vec: Vector2): number {
	return ((vec.x & 0xFFFF) << 16) | (vec.z & 0xFFFF);
}

interface Maze {
	width: number;
	height: number;
}

class WilsonMaze implements Maze {
	readonly width: number;
	readonly height: number;

	readonly cells: Array<CellType>;
	readonly startIndex: number;
	readonly goalIndex: number;

	/**
	 * Construct a maze with the given dimensions. If any of the dimensions is even,
	 * it is rounded up to the nearest odd number.
	 *
	 * @param width the width (in cells) this maze should have
	 * @param height the height (in cells) this maze should have
	 * @param startPos the starting position in this maze. If no starting position is specified, (1, 1) is used.
	 * @param goalPos the goal position in this maze. If no goal position is specified, (width - 2, height - 2) is used.
	 */
	constructor(
		width: number,
		height: number,
		startPos?: Vector2,
		goalPos?: Vector2,
	) {
		this.width = width + (width % 2 == 0 ? 1 : 0);
		this.height = height + (height % 2 == 0 ? 1 : 0);

		const start = startPos === undefined ? { x: 1, z: 1 } : startPos;
		const goal = goalPos === undefined
			? { x: this.width - 2, z: this.height - 2 }
			: goalPos;

		this.startIndex = this.linearize(start.x, start.z);
		this.goalIndex = this.linearize(goal.x, goal.z);

		this.cells = new Array(this.width * this.height);
		for (let z = 0; z < this.height; z++) {
			for (let x = 0; x < this.width; x++) {
				this.cells[z * this.width + x] = CellType.Solid;
			}
		}

		this.cells[this.startIndex] = CellType.Empty;

		this.generateMaze();
	}

	private linearize(x: number, z: number): number {
		return z * this.width + x;
	}

	delinearize(index: number): Vector2 {
		return { x: index % this.width, z: Math.floor(index / this.width) };
	}

	private setCellType(x: number, z: number, cellType: CellType) {
		this.cells[this.linearize(x, z)] = cellType;
	}

	private getCellType(x: number, z: number): CellType {
		return this.cells[this.linearize(x, z)];
	}

	private generateMaze() {
		let unvisitedIntersections =
			Math.floor(this.width / 2) * Math.floor(this.height / 2) - 1;

		while (unvisitedIntersections > 0) {
			const start = this.randomOddCell();
			const path = this.randomWalk(start);

			let curr = start;
			while (this.getCellType(curr.x, curr.z) === CellType.Solid) {
				this.setCellType(curr.x, curr.z, CellType.Empty);
				const dir = path.get(hash(curr))!;
				const between = stepIn(curr, dir, 1);
				this.setCellType(between.x, between.z, CellType.Empty);
				curr = stepIn(curr, dir, 2);

				unvisitedIntersections--;
			}
		}
	}

	private randomWalk(
		start: Vector2,
	): Map<number, Direction> {
		const path = new Map();
		let curr = start;

		while (this.getCellType(curr.x, curr.z) == CellType.Solid) {
			const dir = this.randomDir();
			const nextPos = stepIn(curr, dir, 2);

			if (
				nextPos.x < 0 || nextPos.z < 0 || nextPos.x > this.width - 1 ||
				nextPos.z > this.height - 1
			) {
				continue;
			}

			path.set(hash(curr), dir);

			curr = nextPos;
			if (this.getCellType(nextPos.x, nextPos.z) != CellType.Solid) {
				break;
			}
		}

		return path;
	}

	private randomOddCell(): Vector2 {
		const x = Math.floor(Math.random() * (this.width - 1) / 2);
		const z = Math.floor(Math.random() * (this.height - 1) / 2);

		return { x: 2 * x + 1, z: 2 * z + 1 };
	}

	private randomDir(): Direction {
		const index = Math.floor(Math.random() * 4);
		return index as Direction;
	}

	public startPos(): Vector2 {
		return this.delinearize(this.startIndex);
	}

	public goalPos(): Vector2 {
		return this.delinearize(this.goalIndex);
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
				customColliderOptions: {
					shape: ColliderShape.BLOCK,
					friction: 0,
				},
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

		this.maze.cells.forEach((cell, index) => {
			const pos = this.maze.delinearize(index);
			if (cell === CellType.Solid) {
				// two block high walls
				this.addBlock(pos.x, 1, pos.z, 4);
				this.addBlock(pos.x, 2, pos.z, 4);
			}

			let id = 1;
			if (index == this.maze.startIndex) {
				id = 2;
			} else if (index == this.maze.goalIndex) {
				id = 3;
			}

			// ground plane, with specially marked start- and goal cells
			this.addBlock(pos.x, 0, pos.z, id);
		});
	}

	addBlock(x: number, y: number, z: number, id: number) {
		this.blocks[`${x},${y},${z}`] = id;
	}
}

let currentMaze = new WilsonMaze(15, 15);
let playerInGoal = false;

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

	world.loadMap(new MazeWorld(currentMaze));

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

		const startPos = currentMaze.startPos();

		playerEntity.onBlockCollision = (_entity, blockType, started) => {
			if (!started || playerInGoal || blockType.id != BLOCK_TYPE_GOAL) {
				return;
			}

			playerInGoal = true;
			world.chatManager.sendPlayerMessage(
				player,
				"Congratulations, you successfully solved the maze!",
			);
			world.chatManager.sendPlayerMessage(
				player,
				'To generate a new maze, type "/generate <width> <height>" to generate a <width>x<height> maze.',
			);
		};

		playerEntity.onTick = (entity, _) => {
			const currentStart = currentMaze.startPos();
			const currentGoal = currentMaze.goalPos();

			const com = entity.getWorldCenterOfMass()!;
			const entityPos = { x: Math.floor(com.x), z: Math.floor(com.z) };

			if (entityPos != currentStart && entityPos != currentGoal) {
				world.chunkLattice.setBlock({
					x: entityPos.x,
					y: 0,
					z: entityPos.z,
				}, BLOCK_TYPE_VISITED);
			}
		};

		playerEntity.player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
		playerEntity.player.camera.setOffset({ x: 0, y: 0.7, z: 0 });
		playerEntity.player.camera.setModelHiddenNodes(["head", "neck"]);

		playerEntity.spawn(world, {
			x: startPos.x + 0.5,
			y: 3,
			z: startPos.z + 0.5,
		});

		world.chatManager.sendPlayerMessage(
			player,
			'To generate a new maze, type "/generate <width> <height>" to generate a <width>x<height> maze.',
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

	world.chatManager.registerCommand("/generate", (player, args) => {
		currentMaze = new Maze(
			Number.parseInt(args[0]),
			Number.parseInt(args[1]),
		);
		playerInGoal = false;

		world.chatManager.sendPlayerMessage(
			player,
			`generated a ${currentMaze.width} by ${currentMaze.height} maze.`,
		);
		const startPos = currentMaze.startPos();
		world.entityManager.getAllPlayerEntities(player).forEach((entity) =>
			entity.setTranslation({
				x: startPos.x + 0.5,
				y: 3,
				z: startPos.z + 0.5,
			})
		);

		world.chunkLattice.getAllChunks().forEach((chunk) => chunk.despawn());
		world.loadMap(new MazeWorld(currentMaze));
	});
});
