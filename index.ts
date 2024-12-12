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
} from "hytopia";
import { BlockTypeOptions } from "hytopia";
import { CellType, Maze } from "./Maze.ts";
import { WilsonMaze } from "./Wilson.ts";
import { EdgePercolationMaze } from "./EdgePercolation.ts";

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

let currentMaze = new EdgePercolationMaze(15, 15);
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
		currentMaze = new EdgePercolationMaze(
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
