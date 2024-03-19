import fastify from 'fastify'
import { z } from 'zod'
import { sql } from './lib/postgres'
import postgres from 'postgres'

const app = fastify()
const portNumber = 3000

app.get('/', () => {
    
})

app.get('/links', async () => {
    const result = await sql/*sql*/`
        SELECT *
        FROM shortlinks
        ORDER BY created_at DESC
    `

    return result
})

app.post('/links', async (req, reply) => {
    const createLinkSchema = z.object({
        code: z.string().min(3),
        url: z.string().url(),
    }).parse(req.body)

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

app.listen({
    port: portNumber,
}).then(() => {
    console.log('Server is running on port ', portNumber)
})