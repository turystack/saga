import { describe, expect, it, vi } from 'vitest'

import { Saga } from '@/saga/saga.js'

describe('Saga', () => {
  it('should not run any compensation when all steps succeed', async () => {
    const saga = new Saga('test')
    const comp1 = vi.fn()
    const comp2 = vi.fn()

    saga.addCompensation(comp1)
    saga.addCompensation(comp2)

    expect(comp1).not.toHaveBeenCalled()
    expect(comp2).not.toHaveBeenCalled()
  })

  it('should run compensations in reverse order (LIFO)', async () => {
    const saga = new Saga('test')
    const order: number[] = []

    saga.addCompensation(async () => order.push(1))
    saga.addCompensation(async () => order.push(2))
    saga.addCompensation(async () => order.push(3))

    await saga.rollback()

    expect(order).toEqual([3, 2, 1])
  })

  it('should only rollback compensations added before failure', async () => {
    const saga = new Saga('test')
    const executed: string[] = []

    try {
      executed.push('step1')
      saga.addCompensation(async () => executed.push('comp1'))

      executed.push('step2')
      saga.addCompensation(async () => executed.push('comp2'))

      throw new Error('fail at step3')
    } catch {
      await saga.rollback()
    }

    expect(executed).toEqual(['step1', 'step2', 'comp2', 'comp1'])
  })

  it('should continue running remaining compensations if one fails', async () => {
    const saga = new Saga('test')
    const executed: number[] = []

    saga.addCompensation(async () => executed.push(1))
    saga.addCompensation(async () => {
      throw new Error('comp2 failed')
    })
    saga.addCompensation(async () => executed.push(3))

    await saga.rollback()

    expect(executed).toEqual([3, 1])
  })

  it('should clear compensations after rollback', async () => {
    const saga = new Saga('test')
    const comp = vi.fn()

    saga.addCompensation(comp)
    await saga.rollback()
    await saga.rollback()

    expect(comp).toHaveBeenCalledTimes(1)
  })

  it('should handle rollback with no compensations', async () => {
    const saga = new Saga('test')
    await expect(saga.rollback()).resolves.toBeUndefined()
  })

  it('should work in a realistic flow', async () => {
    const saga = new Saga('test')
    const db: string[] = []

    async function createOrder() {
      try {
        db.push('order_created')
        saga.addCompensation(async () => {
          db.splice(db.indexOf('order_created'), 1)
        })

        db.push('stock_reserved')
        saga.addCompensation(async () => {
          db.splice(db.indexOf('stock_reserved'), 1)
        })

        throw new Error('payment_failed')
      } catch {
        await saga.rollback()
      }
    }

    await createOrder()

    expect(db).toEqual([])
  })
})
