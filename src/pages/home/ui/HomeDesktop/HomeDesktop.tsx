import { AsyncBoundary, Footer } from "@shared/ui"
import { Header } from "@widgets/header"
import { HeroSection } from "../HeroSection"
import s from "./HomeDesktop.module.css"
import { PopularMoviesRail } from "../PopularMoviesRail"
import { TrandingSeriesRail } from "../TrandingSeriesRail"
import { TopAnimeRails } from "../TopAnimeRails"
import { PersonalRails } from "../PersonalRails"
import { MovieRailSkeletonDesktop } from "@widgets/movie-rail"

export const HomeDesktop = () => {
  return (
    <div className={s.root}>
      <Header activeNav="home" />
      <HeroSection />
      <div className={s.rails}>
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <PopularMoviesRail />
        </AsyncBoundary>
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <TrandingSeriesRail />
        </AsyncBoundary>
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <TopAnimeRails />
        </AsyncBoundary>
        <AsyncBoundary fallback={<MovieRailSkeletonDesktop />}>
          <PersonalRails />
        </AsyncBoundary>
      </div>
      <Footer />
    </div>
  )
}
