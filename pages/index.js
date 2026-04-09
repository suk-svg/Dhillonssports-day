import Head from 'next/head'
import SportsDay from '../components/SportsDay'

export default function Home() {
  return (
    <>
      <Head>
        <title>Dhillons Sports Day 2026</title>
        <meta name="description" content="Sports day management system" />
      </Head>
      <SportsDay />
    </>
  )
}
