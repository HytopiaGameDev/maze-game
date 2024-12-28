import { BlockTypeOptions } from "hytopia";
import { CellType, Maze } from "./Maze.ts";

export const BLOCK_TYPE_FLOOR = 1;
export const BLOCK_TYPE_START = 2;
export const BLOCK_TYPE_GOAL = 3;
export const BLOCK_TYPE_WALL = 4;
export const BLOCK_TYPE_VISITED = 5;

export class MazeWorld {
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
				textureUri: "textures/bricks.png",
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
				this.addBlock(pos.x, 1, pos.z, BLOCK_TYPE_WALL);
				this.addBlock(pos.x, 2, pos.z, BLOCK_TYPE_WALL);
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
