import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameFilterOptions,
    getGameById,
    getGamesByFilters,
} from './games';

type SeededGame = {
    title: string;
    categoryId: number;
    publisherId: number;
};

async function seedGames(db: Database): Promise<{
    strategyCategoryId: number;
    puzzleCategoryId: number;
    alphaPublisherId: number;
    betaPublisherId: number;
    seededGames: SeededGame[];
}> {
    const [strategyCategory, puzzleCategory] = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'Strategy games' },
            { name: 'Puzzle', description: 'Puzzle games' },
        ])
        .returning({ id: categories.id, name: categories.name });
    const [alphaPublisher, betaPublisher] = await db
        .insert(publishers)
        .values([
            { name: 'Alpha Studio', description: 'Publisher alpha' },
            { name: 'Beta Games', description: 'Publisher beta' },
        ])
        .returning({ id: publishers.id, name: publishers.name });

    const seededGames: SeededGame[] = [
        { title: 'Alpha Ops', categoryId: strategyCategory.id, publisherId: alphaPublisher.id },
        { title: 'Beta Blocks', categoryId: puzzleCategory.id, publisherId: alphaPublisher.id },
        { title: 'Gamma Grid', categoryId: strategyCategory.id, publisherId: betaPublisher.id },
        { title: 'Delta Debug', categoryId: puzzleCategory.id, publisherId: betaPublisher.id },
    ];

    await db.insert(games).values(
        seededGames.map((game) => ({
            title: game.title,
            description: `Description for ${game.title}`,
            starRating: 4.2,
            categoryId: game.categoryId,
            publisherId: game.publisherId,
        })),
    );

    return {
        strategyCategoryId: strategyCategory.id,
        puzzleCategoryId: puzzleCategory.id,
        alphaPublisherId: alphaPublisher.id,
        betaPublisherId: betaPublisher.id,
        seededGames,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Alpha Ops', 'Beta Blocks', 'Delta Debug', 'Gamma Grid']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: expect.any(String) });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: expect.any(String) });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Alpha Ops');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by one or more categories', async () => {
        const seeded = await seedGames(db);
        const filtered = await getGamesByFilters(db, {
            categoryIds: [seeded.strategyCategoryId, seeded.strategyCategoryId],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Ops', 'Gamma Grid']);
    });

    it('filters games by publisher', async () => {
        const seeded = await seedGames(db);
        const filtered = await getGamesByFilters(db, { publisherId: seeded.alphaPublisherId });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Ops', 'Beta Blocks']);
    });

    it('combines category and publisher filters', async () => {
        const seeded = await seedGames(db);
        const filtered = await getGamesByFilters(db, {
            categoryIds: [seeded.puzzleCategoryId],
            publisherId: seeded.betaPublisherId,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Delta Debug']);
    });

    it('returns all games when filtering with empty criteria', async () => {
        const seeded = await seedGames(db);
        const filtered = await getGamesByFilters(db, { categoryIds: [] });

        expect(filtered.map((game) => game.title)).toEqual(
            seeded.seededGames.map((game) => game.title).sort((a, b) => a.localeCompare(b)),
        );
    });

    it('returns sorted filter options for categories and publishers', async () => {
        await seedGames(db);
        const options = await getGameFilterOptions(db);

        expect(options.categories.map((option) => option.name)).toEqual(['Puzzle', 'Strategy']);
        expect(options.publishers.map((option) => option.name)).toEqual(['Alpha Studio', 'Beta Games']);
    });
});
