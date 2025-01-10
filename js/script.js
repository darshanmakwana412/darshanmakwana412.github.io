document.addEventListener("DOMContentLoaded", () => {
    const hoverHighlight = document.getElementById("hoverHighlight");
    const links = document.querySelectorAll(".trigger .page-link");
    let activeLink = null;
    let initialRender = true;
    let dw = 15;
    let dh = 15;

    function moveHighlight(link) {
        const linkRect = link.getBoundingClientRect();
        const navbarRect = link.parentElement.getBoundingClientRect();
        if (initialRender || activeLink ===  null) {
            hoverHighlight.style.transition = null;
            initialRender = false;
        } else {
            hoverHighlight.style.transition = "all 0.5s ease";
        }
        hoverHighlight.style.width = `${linkRect.width + dw}px`;
        hoverHighlight.style.height = `${linkRect.height + dh}px`;
        hoverHighlight.style.marginLeft = `${linkRect.left - navbarRect.left - dw / 2}px`;
        hoverHighlight.style.marginTop = `${linkRect.top - navbarRect.top - dh / 2}px`;
    }

    links.forEach(link => {
        let ctx = link.href.split("/").at(-1);
        if (ctx !== '') {
          if (window.location.href.includes(ctx.slice(0, -5))) {
            activeLink = link;
            moveHighlight(activeLink);
          }
        } else {
          activeLink = link;
          // moveHighlight(activeLink);
        }
        link.addEventListener("mouseenter", () => {
            moveHighlight(link);
        });
        link.addEventListener("click", () => {
          initialRender = true;
          activeLink = link;
          moveHighlight(activeLink);
        });
    });

    document.querySelector(".trigger").addEventListener("mouseleave", () => {
      if (activeLink) {
        moveHighlight(activeLink);
      } else {
        hoverHighlight.style.width = "0px";
        hoverHighlight.style.height = "0px";
      }
    });

    moveHighlight(activeLink);

  });