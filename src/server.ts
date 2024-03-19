import fastify from 'fastify'
import { z } from 'zod'
import { sql } from './lib/postgres'
import postgres from 'postgres'
import { redis } from './lib/redis'

const app = fastify()
const portNumber = 3000

app.get('/:code', async (req, reply) => {
    const getLinksSchema = z.object({
        code: z.string().min(3),
    })

    const { code } = getLinksSchema.parse(req.params)

    const result = await sql/*sql*/`
        SELECT id, original_url
        FROM shortlinks
        WHERE short_links.code = ${code}
    `

    const link = result[0]

    if (result.length === 0) {
        return reply.status(400).send({ message: 'Link not found' })
    }

    await redis.zIncrBy('metrics', 1, String(link.id))

    return reply.redirect(301, link.original_url)
})

app.get('/api/links', async () => {
    const result = await sql/*sql*/`
        SELECT *
        FROM shortlinks
        ORDER BY created_at DESC
    `

    return result
})

app.post('/api/links', async (req, reply) => {
    const createLinkSchema = z.object({
        code: z.string().min(3),
        url: z.string().url(),
    })

    // FIXME: Property 'parse' does not exist on type '{ url: string; code: string; }'.
    const { code, url } = createLinkSchema.parse(req.body)

    try {
        const result = await sql/*sql*/`
        INSERT INTO shortlinks (code, original_url)
        VALUES (${code}, ${url})
        RETURNING id
    `

    const link = result[0]

    return reply.status(201).send({ shortLinkId: link.id})
    } catch (error) {
        if (error instanceof postgres.PostgresError) {
            if (error.code === '23505') {
                return reply.status(400).send({ message: 'Duplicated Code' })
            }
        }

        console.log(error)

        return reply.status(500).send({ message: 'Internal Error'})
    }
})

app.get('/api/metrics', async () => {
    const result = await redis.zRangeByScoreWithScores('metrics', 0, 50);

    const metrics = result.sort((a, b) => b.score - a.score).map(item => {
        return {
            shortLinkId: Number(item.value),
            clicks: item.score
        }
    })

    return metrics
})

app.listen({
    port: portNumber,
}).then(() => {
    console.log('Server is running on port', portNumber)
})