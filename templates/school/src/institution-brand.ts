import { institutionBrand } from '../content/institution-brand.ts';
import './styles/institution-brand.css';

const demoImages = {
  heroImage: '/images/institution/campus-project.webp',
  teacherImage: '/images/institution/teacher-class.jpg',
  activities: '/images/institution/lesson.jpg',
  extracurricular: '/images/institution/art.jpg',
  immersion: '/images/institution/school-entrance.jpg',
  journeyMain: '/images/institution/friends-outdoors.jpg',
  journeyDetail: '/images/institution/classmates.jpg',
  achievement: '/images/institution/lab.jpg',
  immersionFeature: '/images/institution/team.jpg',
  invitation: '/images/institution/class-project.jpg',
  event: '/images/institution/school-community.jpg',
};

export function schoolBrand(demo: boolean) {
  const fallback = (value: string, sample: string) => value || (demo ? sample : '');
  return {
    logo: institutionBrand.logo,
    heroImage: institutionBrand.heroImage,
    fallbackHeroImage: demo ? demoImages.heroImage : '',
    teacherImage: fallback(institutionBrand.teacherImage, demoImages.teacherImage),
    images: {
      activities: fallback(institutionBrand.images.activities, demoImages.activities),
      extracurricular: fallback(institutionBrand.images.extracurricular, demoImages.extracurricular),
      immersion: fallback(institutionBrand.images.immersion, demoImages.immersion),
      journeyMain: fallback(institutionBrand.images.journeyMain, demoImages.journeyMain),
      journeyDetail: fallback(institutionBrand.images.journeyDetail, demoImages.journeyDetail),
      achievement: fallback(institutionBrand.images.achievement, demoImages.achievement),
      immersionFeature: fallback(institutionBrand.images.immersionFeature, demoImages.immersionFeature),
      invitation: fallback(institutionBrand.images.invitation, demoImages.invitation),
      event: demo ? demoImages.event : '',
    },
  };
}
