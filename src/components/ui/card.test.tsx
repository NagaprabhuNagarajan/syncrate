import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

describe("Card", () => {
  it("renders a full card composition", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">Body</CardContent>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("merges custom classNames on every sub-component", () => {
    render(
      <Card className="card-c">
        <CardHeader className="header-c">
          <CardTitle className="title-c">T</CardTitle>
          <CardDescription className="desc-c">D</CardDescription>
        </CardHeader>
        <CardContent className="content-c">C</CardContent>
        <CardFooter className="footer-c">F</CardFooter>
      </Card>
    );

    expect(screen.getByText("T").closest(".title-c")).not.toBeNull();
    expect(screen.getByText("D")).toHaveClass("desc-c");
    expect(screen.getByText("C")).toHaveClass("content-c");
    expect(screen.getByText("F")).toHaveClass("footer-c");
  });

  it("forwards refs to the underlying DOM nodes", () => {
    const cardRef = createRef<HTMLDivElement>();
    const headerRef = createRef<HTMLDivElement>();
    const titleRef = createRef<HTMLDivElement>();
    const descRef = createRef<HTMLDivElement>();
    const contentRef = createRef<HTMLDivElement>();
    const footerRef = createRef<HTMLDivElement>();

    render(
      <Card ref={cardRef}>
        <CardHeader ref={headerRef}>
          <CardTitle ref={titleRef}>T</CardTitle>
          <CardDescription ref={descRef}>D</CardDescription>
        </CardHeader>
        <CardContent ref={contentRef}>C</CardContent>
        <CardFooter ref={footerRef}>F</CardFooter>
      </Card>
    );

    expect(cardRef.current).toBeInstanceOf(HTMLDivElement);
    expect(headerRef.current).toBeInstanceOf(HTMLDivElement);
    expect(titleRef.current).toBeInstanceOf(HTMLDivElement);
    expect(descRef.current).toBeInstanceOf(HTMLDivElement);
    expect(contentRef.current).toBeInstanceOf(HTMLDivElement);
    expect(footerRef.current).toBeInstanceOf(HTMLDivElement);
  });

  it("sets displayNames for each sub-component", () => {
    expect(Card.displayName).toBe("Card");
    expect(CardHeader.displayName).toBe("CardHeader");
    expect(CardTitle.displayName).toBe("CardTitle");
    expect(CardDescription.displayName).toBe("CardDescription");
    expect(CardContent.displayName).toBe("CardContent");
    expect(CardFooter.displayName).toBe("CardFooter");
  });
});
