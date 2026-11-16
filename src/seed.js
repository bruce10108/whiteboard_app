import { Timestamp, collection, doc, getDoc, runTransaction } from 'firebase/firestore'
import { db } from './firebase'

const DAILY = ['洗衣服', '洗奶瓶', '收衣服']

const TRACKERS = [
  ['洗衣服', 3],
  ['倒垃圾', 2],
  ['清水壺水垢', 4],
  ['清消毒鍋水垢', 10],
  ['清理浴室排水孔', 14],
  ['客廳冷氣濾網', 30],
  ['臥室冷氣濾網', 30],
]

/**
 * Fill in the starter lists the first time anyone opens the app.
 * A flag document makes this run once, even if both phones open at the same
 * time, and lets the family delete starter items without them coming back.
 */
export async function seedDefaults() {
  const flag = doc(db, 'meta', 'seed')
  if ((await getDoc(flag)).exists()) return // usually answered from the local cache

  await runTransaction(db, async (tx) => {
    if ((await tx.get(flag)).exists()) return
    DAILY.forEach((title, order) => tx.set(doc(collection(db, 'daily')), { title, order }))
    TRACKERS.forEach(([title, intervalDays]) =>
      tx.set(doc(collection(db, 'trackers')), {
        title,
        intervalDays,
        lastDoneAt: null,
        lastDoneBy: null,
        createdAt: Timestamp.now(),
      }),
    )
    tx.set(flag, { at: Timestamp.now() })
  })
}
