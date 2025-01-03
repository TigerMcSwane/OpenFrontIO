import { getConfig } from "./configuration/Config";
import { EventBus } from "./EventBus";
import { Executor } from "./execution/ExecutionManager";
import { WinCheckExecution } from "./execution/WinCheckExecution";
import { Game, MutableGame, MutableTile, Tile, TileEvent } from "./game/Game";
import { createGame } from "./game/GameImpl";
import { loadTerrainMap } from "./game/TerrainMapLoader";
import { GameUpdateViewData } from "./GameView";
import { GameConfig, Turn } from "./Schemas";

export async function createGameRunner(gameID: string, gameConfig: GameConfig, callBack: (gu: GameUpdateViewData) => void): Promise<GameRunner> {
    const config = getConfig(gameConfig)
    const terrainMap = await loadTerrainMap(gameConfig.gameMap);
    const eventBus = new EventBus()
    const game = createGame(terrainMap.map, terrainMap.miniMap, eventBus, config)
    const gr = new GameRunner(game as MutableGame, eventBus, new Executor(game, gameID), callBack)
    gr.init()
    return gr
}

export class GameRunner {
    private updatedTiles: MutableTile[]
    private tickInterval = null
    private turns: Turn[] = []
    private currTurn = 0
    private isExecuting = false

    constructor(
        private game: MutableGame,
        private eventBus: EventBus,
        private execManager: Executor,
        private callBack: (gu: GameUpdateViewData) => void
    ) {
    }

    init() {
        this.eventBus.on(TileEvent, (e) => { this.updatedTiles.push(e.tile as MutableTile) })
        this.game.addExecution(...this.execManager.spawnBots(this.game.config().numBots()))
        if (this.game.config().spawnNPCs()) {
            this.game.addExecution(...this.execManager.fakeHumanExecutions())
        }
        this.game.addExecution(new WinCheckExecution(this.eventBus))
        this.tickInterval = setInterval(() => this.executeNextTick(), 10)
    }

    public addTurn(turn: Turn): void {
        this.turns.push(turn)
    }

    public executeNextTick() {
        if (this.isExecuting) {
            return
        }
        if (this.currTurn >= this.turns.length) {
            return
        }
        this.isExecuting = true
        this.updatedTiles = []


        this.game.addExecution(...this.execManager.createExecs(this.turns[this.currTurn]))
        this.currTurn++
        this.game.executeNextTick()

        this.callBack({
            units: this.game.units().map(u => u.toViewData()),
            tileUpdates: this.updatedTiles.map(t => t.toViewData()),
            players: this.game.players().map(p => p.toViewData())
        })

        this.isExecuting = false
    }

}