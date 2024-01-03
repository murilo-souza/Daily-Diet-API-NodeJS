import { FastifyInstance } from 'fastify'
import { knex } from '../database'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { checkSessionIdExists } from '../middlewares/check-session-id-exists'

export async function mealsRoute(app: FastifyInstance) {
  app.post(
    '/',
    {
      preHandler: [checkSessionIdExists],
    },

    async (request, reply) => {
      const createMealBodySchema = z.object({
        name: z.string(),
        description: z.string(),
        isOnDiet: z.boolean(),
        date: z.coerce.date(),
      })

      const { name, description, isOnDiet, date } = createMealBodySchema.parse(
        request.body,
      )

      await knex('meals').insert({
        id: randomUUID(),
        name,
        description,
        is_on_diet: isOnDiet,
        date: date.getTime(),
        user_id: request.user?.id,
      })

      return reply.status(201).send()
    },
  )

  app.get('/', { preHandler: [checkSessionIdExists] }, async (request) => {
    const meals = await knex('meals')
      .where({ user_id: request.user?.id })
      .select()

    return {
      meals,
    }
  })

  app.get(
    '/:mealId',
    { preHandler: [checkSessionIdExists] },
    async (request, reply) => {
      const getTransactionParamsSchema = z.object({
        mealId: z.string().uuid(),
      })

      const { mealId } = getTransactionParamsSchema.parse(request.params)

      const meal = await knex('meals')
        .where({ user_id: request.user?.id, id: mealId })
        .first()

      if (!meal) {
        return reply.status(404).send({ error: 'Meal not found' })
      }

      return {
        meal,
      }
    },
  )

  app.put(
    '/:mealId',
    { preHandler: [checkSessionIdExists] },
    async (request, reply) => {
      const paramsSchema = z.object({ mealId: z.string().uuid() })

      const { mealId } = paramsSchema.parse(request.params)

      const updateMealBodySchema = z.object({
        name: z.string(),
        description: z.string(),
        isOnDiet: z.boolean(),
        date: z.coerce.date(),
      })

      const { name, description, isOnDiet, date } = updateMealBodySchema.parse(
        request.body,
      )

      const meal = await knex('meals')
        .where({ user_id: request.user?.id, id: mealId })
        .first()

      if (!meal) {
        return reply.status(404).send({ error: 'Meal not found' })
      }

      await knex('meals')
        .where({ user_id: request.user?.id, id: mealId })
        .update({
          name,
          description,
          is_on_diet: isOnDiet,
          date: date.getTime(),
        })

      return reply.status(204).send()
    },
  )

  app.delete(
    '/:mealId',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request, reply) => {
      const paramsSchema = z.object({ mealId: z.string().uuid() })

      const { mealId } = paramsSchema.parse(request.params)

      const meal = await knex('meals')
        .where({ user_id: request.user?.id, id: mealId })
        .first()

      if (!meal) {
        return reply.status(404).send({ error: 'Meal not found' })
      }

      await knex('meals')
        .where({ user_id: request.user?.id, id: mealId })
        .delete()
    },
  )

  app.get(
    '/metrics',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const totalMeals = await knex('meals')
        .where({ user_id: request.user?.id })
        .orderBy('date', 'desc')

      const totalMealsOnDiet = await knex('meals')
        .where({ user_id: request.user?.id, is_on_diet: true })
        .count('id', { as: 'meals' })
        .first()

      const totalMealsOffDiet = await knex('meals')
        .where({ user_id: request.user?.id, is_on_diet: false })
        .count('id', { as: 'meals' })
        .first()

      const { bestOnDietSequence } = totalMeals.reduce(
        (acc, meal) => {
          if (meal.is_on_diet) {
            acc.currentSequence += 1
          } else {
            acc.currentSequence = 0
          }

          if (acc.currentSequence > acc.bestOnDietSequence) {
            acc.bestOnDietSequence = acc.currentSequence
          }

          return acc
        },
        { bestOnDietSequence: 0, currentSequence: 0 },
      )

      return {
        totalMeals: totalMeals.length,
        totalMealsOnDiet,
        totalMealsOffDiet,
        bestOnDietSequence,
      }
    },
  )
}
