/** Whether a student's sign-in is handing over to practice right now
 * (join/api.ts's useFinishSignIn): a screen that remounts meanwhile keeps
 * the wave going. Its own tiny module, so the app's entry (the router, boot)
 * reads it without the join API. */
let finishing = false;
export const finishingSignIn = () => finishing;
export const setFinishingSignIn = (value: boolean) => {
  finishing = value;
};
