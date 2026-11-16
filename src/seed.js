import { Timestamp, collection, doc, getDoc, getDocs, runTransaction, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

const DAILY = ['洗孩子衣服', '洗奶瓶', '收衣服']

const TRACKERS = [
  ['洗大人衣服', 3],
  ['倒垃圾', 2],
  ['清水壺水垢', 4],
  ['清消毒鍋水垢', 10],
  ['清理浴室排水孔', 14],
  ['客廳冷氣濾網', 30],
  ['臥室冷氣濾網', 30],
]

const VERSION = 2

/**
 * Fill in the starter lists the first time anyone opens the app, and apply
 * one-off data fixes for older versions. A flag document (meta/seed) makes
 * each step run once and lets the family delete starter items for good.
 */
export async function seedDefaults() {
  const flagRef = doc(db, 'meta', 'seed')
  const flag = await getDoc(flagRef) // usually answered from the local cache

  if (!flag.exists()) {
    await runTransaction(db, async (tx) => {
      if ((await tx.get(flagRef)).exists()) return
      const now = Timestamp.now()
      DAILY.forEach((title, order) => tx.set(doc(collection(db, 'daily')), { title, order }))
      TRACKERS.forEach(([title, intervalDays]) =>
        tx.set(doc(collection(db, 'trackers')), {
          title,
          intervalDays,
          lastDoneAt: now,
          lastDoneBy: null,
          createdAt: now,
        }),
      )
      tx.set(flagRef, { at: now, version: VERSION })
    })
    return
  }

  if ((flag.data().version ?? 1) < 2) await migrateToV2(flagRef)
}

/** v2: rename the two laundry items and start every tracker as "done today". */
async function migrateToV2(flagRef) {
  const [daily, trackers] = await Promise.all([getDocs(collection(db, 'daily')), getDocs(collection(db, 'trackers'))])
  const batch = writeBatch(db)
  const now = Timestamp.now()

  daily.forEach((d) => {
    if (d.data().title === '洗衣服') batch.update(d.ref, { title: '洗孩子衣服' })
  })
  trackers.forEach((d) => {
    const change = {}
    if (d.data().title === '洗衣服') change.title = '洗大人衣服'
    if (!d.data().lastDoneAt) change.lastDoneAt = now
    if (Object.keys(change).length) batch.update(d.ref, change)
  })
  batch.update(flagRef, { version: 2 })
  await batch.commit()
}
