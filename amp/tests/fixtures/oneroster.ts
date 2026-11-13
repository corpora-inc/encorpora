import type { OneRosterFiles } from "../../src/schools/sources/oneroster.js";
export const oneRosterFixture = (): OneRosterFiles => ({
  orgs: "sourcedId,name,type,parentSourcedId\na,School A,school,d\nb,School B,school,d\nd,District,district,\n",
  users:
    "sourcedId,enabledUser,givenName,familyName,preferredGivenName,preferredFamilyName,primaryOrgSourcedId,grades\nt,true,Teacher,Fixture,Tessa,Fixture,a,\nu,true,Student,Fixture,,,a,4\n",
  roles:
    "sourcedId,userSourcedId,orgSourcedId,role,roleType,beginDate,endDate\nrt,t,a,teacher,primary,2020-01-01,2099-01-01\nrs,t,a,staff,secondary,2020-01-01,2099-01-01\nrb,t,b,teacher,primary,2020-01-01,2099-01-01\nru,u,a,student,primary,2999-01-01,2999-12-31\n",
  academicSessions:
    "sourcedId,title,type,startDate,endDate,parentSourcedId\ny,2026-27,schoolYear,2026-08-01,2027-07-31,\ns1,Fall,semester,2026-08-01,2027-01-01,y\ns2,Spring,semester,2027-01-02,2027-07-31,y\n",
  courses: "sourcedId,title,grades,schoolYearSourcedId\nc,Math,4,y\n",
  classes:
    'sourcedId,title,courseSourcedId,schoolSourcedId,termSourcedIds\nk1,Math,c,a,"s1,s2"\nk2,Support,c,a,s1\nk3,Other school,c,b,"s1,s2"\n',
  enrollments:
    "sourcedId,userSourcedId,classSourcedId,schoolSourcedId,role,beginDate,endDate\net,t,k1,a,teacher,2020-01-01,2099-01-01\nea,t,k2,a,aide,2020-01-01,2099-01-01\neb,t,k3,b,teacher,2020-01-01,2099-01-01\neu,u,k1,a,student,2999-01-01,2999-12-31\n",
});
