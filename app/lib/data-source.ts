import "reflect-metadata";
import { DataSource } from "typeorm";
import { Project } from "./entities/Project.js";
import { Asset } from "./entities/Asset.js";
import path from "path";

export const AppDataSource = new DataSource({
    type: "better-sqlite3",
    database: process.env.DATABASE_URL || "database.sqlite",
    synchronize: true, // Auto-create tables (dev only)
    logging: false,
    entities: [Project, Asset],
    subscribers: [],
    migrations: [],
});

let isInitializing = false;

export const initializeDataSource = async () => {
    if (!AppDataSource.isInitialized && !isInitializing) {
        isInitializing = true;
        try {
            await AppDataSource.initialize();
            console.log("Data Source has been initialized!");
        } catch (err) {
            console.error("Error during Data Source initialization", err);
            throw err;
        } finally {
            isInitializing = false;
        }
    }
    // Wait if initializing
    while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return AppDataSource;
};
