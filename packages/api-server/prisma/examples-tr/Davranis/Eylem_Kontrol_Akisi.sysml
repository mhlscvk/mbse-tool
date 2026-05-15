package EylemKontrolAkisi {

  action def AracaBin;
  action def HedefeKadarSur;
  action def AractanIn;

  action yolcuTasi {
    action suruculBinis : AracaBin;
    action yolcuBinis : AracaBin;
    action sur : HedefeKadarSur;
    action suruculInis : AractanIn;
    action yolcuInis : AractanIn;

    first start then catal1;
    fork catal1;
    first catal1 then suruculBinis;
    first catal1 then yolcuBinis;
    first suruculBinis then birlestir1;
    first yolcuBinis then birlestir1;
    join birlestir1;
    first birlestir1 then sur;
    first sur then catal2;
    fork catal2;
    first catal2 then suruculInis;
    first catal2 then yolcuInis;
    first suruculInis then birlestir2;
    first yolcuInis then birlestir2;
    join birlestir2;
    first birlestir2 then done;
  }
}