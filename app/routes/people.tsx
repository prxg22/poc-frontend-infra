import { defer } from '@remix-run/node/dist'
import { Await, useLoaderData } from '@remix-run/react'
import { Suspense } from 'react'

export async function loader() {
  const person2 = new Promise<{ name: string }>((resolve) => {
    setTimeout(() => {
      resolve({ name: 'Joe Boring Doe' })
    }, 4000)
  })

  return defer(
    {
      person1: {
        name: 'Joe Doe',
      },
      person2,
    },
    {
      headers: {
        'cache-control': 'max-age=20; s-maxage=40',
        'set-cookie': 'cookie1=1;',
      },
    },
  )
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <>
      <p>{loaderData.person1.name}</p>
      <Suspense fallback={<p>loading...</p>}>
        <Await
          resolve={loaderData.person2}
          errorElement={<p>fucking error!</p>}
        >
          {(person) => (
            <p>
              <strong>Person:</strong> {person.name}
            </p>
          )}
        </Await>
      </Suspense>
    </>
  )
}
