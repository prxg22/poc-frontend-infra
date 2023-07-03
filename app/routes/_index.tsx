import {
  defer,
  json,
  type LoaderArgs,
  type V2_MetaFunction,
} from '@remix-run/node'
import { Await, Link, useLoaderData } from '@remix-run/react'
import { Suspense } from 'react'

export const meta: V2_MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { name: 'description', content: 'Welcome to Remix!' },
  ]
}

export default function Index() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <ul>
        <li>
          <Link to="/people">People</Link>
        </li>
      </ul>
    </div>
  )
}
